import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase, mongoClient } from "../../database/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
  sessionExpiry,
  setSessionCookie,
} from "../../lib/auth.js";
import { defaultCategories } from "./defaults.js";
import {
  avatarSchema,
  changePasswordSchema,
  deleteAccountSchema,
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
} from "./schemas.js";

type UserDocument = {
  _id: ObjectId;
  name: string;
  email: string;
  emailNormalized: string;
  passwordHash?: string;
  avatarUrl?: string;
  status: "active" | "suspended" | "deletion_pending";
  preferences?: {
    currency?: string;
    timezone?: string;
    language?: string;
    dateFormat?: string;
    theme?: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

function publicUser(user: UserDocument) {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    emailVerified: !!user.emailVerifiedAt,
    preferences: user.preferences ?? {},
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const db = await getDatabase();
      const emailNormalized = input.email.toLowerCase();

      if (await db.collection("users").findOne({ emailNormalized }, { projection: { _id: 1 } })) {
        return reply
          .code(409)
          .send({ error: "EMAIL_EXISTS", message: "An account with this email already exists." });
      }

      const now = new Date();
      const userId = new ObjectId();
      const workspaceId = new ObjectId();
      const accountId = new ObjectId();
      const sessionId = new ObjectId();
      const sessionToken = createSessionToken();
      const verificationToken = randomBytes(32).toString("hex");
      const expiresAt = sessionExpiry();
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const session = mongoClient.startSession();

      try {
        await session.withTransaction(async () => {
          await db.collection("users").insertOne(
            {
              _id: userId,
              name: input.name,
              email: input.email,
              emailNormalized,
              passwordHash,
              preferences: {
                currency: input.currency,
                language: "en-US",
                timezone: input.timezone,
                dateFormat: "DD/MM/YYYY",
                theme: "system",
              },
              status: "active",
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          await db.collection("workspaces").insertOne(
            {
              _id: workspaceId,
              name: `${input.name}'s Workspace`,
              type: "personal",
              ownerId: userId,
              settings: {
                defaultCurrency: input.currency,
                timezone: input.timezone,
                fiscalYearStartMonth: 1,
              },
              status: "active",
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          await db.collection("workspaceMembers").insertOne(
            {
              workspaceId,
              userId,
              role: "owner",
              status: "active",
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          await db.collection("accounts").insertOne(
            {
              _id: accountId,
              workspaceId,
              name: "Cash",
              type: "cash",
              currency: input.currency,
              openingBalanceMinor: 0,
              currentBalanceMinor: 0,
              includeInTotals: true,
              isDefault: true,
              status: "active",
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          await db.collection("categories").insertMany(
            defaultCategories.map(([name, normalizedName, color, icon]) => ({
              workspaceId,
              name,
              normalizedName,
              type: "expense",
              color,
              icon,
              isSystem: true,
              status: "active",
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
            })),
            { session },
          );
          await db.collection("authSessions").insertOne(
            {
              _id: sessionId,
              userId,
              tokenHash: hashSessionToken(sessionToken),
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"],
              expiresAt,
              lastUsedAt: now,
              createdAt: now,
            },
            { session },
          );
          await db.collection("authTokens").insertOne(
            {
              userId,
              purpose: "verify_email",
              tokenHash: hashSessionToken(verificationToken),
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              createdAt: now,
            },
            { session },
          );
          await db.collection("auditLogs").insertOne(
            {
              workspaceId,
              actorId: userId,
              action: "user.registered",
              entityType: "user",
              entityId: userId,
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"],
              createdAt: now,
            },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }

      setSessionCookie(reply, sessionToken, expiresAt);
      return reply.code(201).send({
        user: publicUser({
          _id: userId,
          name: input.name,
          email: input.email,
          emailNormalized,
          passwordHash,
          status: "active",
          preferences: { currency: input.currency, timezone: input.timezone },
          createdAt: now,
          updatedAt: now,
        }),
        workspace: {
          id: workspaceId.toHexString(),
          name: `${input.name}'s Workspace`,
          type: "personal",
          role: "owner",
        },
        verificationToken,
      });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const db = await getDatabase();
      const user = await db
        .collection<UserDocument>("users")
        .findOne({ emailNormalized: input.email.toLowerCase() });

      if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
        return reply
          .code(401)
          .send({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
      }
      if (user.status !== "active") {
        return reply
          .code(403)
          .send({ error: "ACCOUNT_UNAVAILABLE", message: "This account is not active." });
      }

      const token = createSessionToken();
      const expiresAt = sessionExpiry();
      const now = new Date();
      await db.collection("authSessions").insertOne({
        userId: user._id,
        tokenHash: hashSessionToken(token),
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        expiresAt,
        lastUsedAt: now,
        createdAt: now,
      });
      await db
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { lastLoginAt: now, updatedAt: now } });

      setSessionCookie(reply, token, expiresAt);
      return { user: publicUser(user) };
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const db = await getDatabase();
      await db.collection("authSessions").deleteOne({ tokenHash: hashSessionToken(token) });
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.patch("/auth/profile", { preHandler: authenticate }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    const db = await getDatabase();
    const emailNormalized = input.email.toLowerCase();
    const duplicate = await db.collection("users").findOne({
      emailNormalized,
      _id: { $ne: request.auth!.userId },
    });
    if (duplicate) {
      return reply
        .code(409)
        .send({ error: "EMAIL_EXISTS", message: "An account with this email already exists." });
    }

    const user = await db.collection<UserDocument>("users").findOneAndUpdate(
      { _id: request.auth!.userId, status: "active" },
      {
        $set: {
          name: input.name,
          email: input.email,
          emailNormalized,
          "preferences.currency": input.currency,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!user) {
      return reply
        .code(404)
        .send({ error: "USER_NOT_FOUND", message: "Your account could not be found." });
    }
    return { user: publicUser(user) };
  });

  app.post("/auth/change-password", { preHandler: authenticate }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    const db = await getDatabase();
    const user = await db.collection<UserDocument>("users").findOne({ _id: request.auth!.userId });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
      return reply.code(400).send({
        error: "CURRENT_PASSWORD_INVALID",
        message: "The current password is incorrect.",
      });
    }
    if (await argon2.verify(user.passwordHash, input.newPassword)) {
      return reply.code(400).send({
        error: "PASSWORD_UNCHANGED",
        message: "Choose a password different from your current password.",
      });
    }

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await argon2.hash(input.newPassword, { type: argon2.argon2id }),
          updatedAt: new Date(),
        },
      },
    );
    return reply.code(204).send();
  });

  app.post("/auth/logout-other-sessions", { preHandler: authenticate }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    const db = await getDatabase();
    await db.collection("authSessions").deleteMany({
      userId: request.auth!.userId,
      ...(token ? { tokenHash: { $ne: hashSessionToken(token) } } : {}),
    });
    return reply.code(204).send();
  });

  app.patch("/auth/avatar", { preHandler: authenticate }, async (request) => {
    const { dataUrl } = avatarSchema.parse(request.body);
    const db = await getDatabase();
    const user = await db.collection<UserDocument>("users").findOneAndUpdate(
      { _id: request.auth!.userId, status: "active" },
      { $set: { avatarUrl: dataUrl, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    return { user: publicUser(user!) };
  });

  app.post("/auth/request-verification", { preHandler: authenticate }, async () => {
    const db = await getDatabase();
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    await db.collection("authTokens").deleteMany({
      userId: request.auth!.userId,
      purpose: "verify_email",
      usedAt: { $exists: false },
    });
    await db.collection("authTokens").insertOne({
      userId: request.auth!.userId,
      purpose: "verify_email",
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
    });
    return { token };
  });

  app.post("/auth/verify-email", async (request, reply) => {
    const { token } = tokenSchema.parse(request.body);
    const db = await getDatabase();
    const now = new Date();
    const record = await db.collection("authTokens").findOneAndUpdate(
      {
        tokenHash: hashSessionToken(token),
        purpose: "verify_email",
        expiresAt: { $gt: now },
        usedAt: { $exists: false },
      },
      { $set: { usedAt: now } },
      { returnDocument: "after" },
    );
    if (!record) {
      return reply.code(400).send({ error: "INVALID_TOKEN", message: "This verification link is invalid or expired." });
    }
    await db.collection("users").updateOne(
      { _id: record.userId },
      { $set: { emailVerifiedAt: now, updatedAt: now } },
    );
    return reply.code(204).send();
  });

  app.post("/auth/forgot-password", async (request) => {
    const { email } = emailSchema.parse(request.body);
    const db = await getDatabase();
    const user = await db.collection<UserDocument>("users").findOne({
      emailNormalized: email.toLowerCase(),
      status: "active",
    });
    if (!user) return { accepted: true };
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    await db.collection("authTokens").deleteMany({
      userId: user._id,
      purpose: "reset_password",
      usedAt: { $exists: false },
    });
    await db.collection("authTokens").insertOne({
      userId: user._id,
      purpose: "reset_password",
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
    });
    return { accepted: true, token };
  });

  app.post("/auth/reset-password", async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    const db = await getDatabase();
    const now = new Date();
    const record = await db.collection("authTokens").findOneAndUpdate(
      {
        tokenHash: hashSessionToken(input.token),
        purpose: "reset_password",
        expiresAt: { $gt: now },
        usedAt: { $exists: false },
      },
      { $set: { usedAt: now } },
      { returnDocument: "after" },
    );
    if (!record) {
      return reply.code(400).send({ error: "INVALID_TOKEN", message: "This reset link is invalid or expired." });
    }
    await db.collection("users").updateOne(
      { _id: record.userId },
      { $set: { passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }), updatedAt: now } },
    );
    await db.collection("authSessions").deleteMany({ userId: record.userId });
    return reply.code(204).send();
  });

  app.delete("/auth/account", { preHandler: authenticate }, async (request, reply) => {
    const { password } = deleteAccountSchema.parse(request.body);
    const db = await getDatabase();
    const user = await db.collection<UserDocument>("users").findOne({ _id: request.auth!.userId });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      return reply.code(400).send({ error: "PASSWORD_INVALID", message: "The password is incorrect." });
    }
    const now = new Date();
    const session = mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $set: { status: "deletion_pending", updatedAt: now } },
          { session },
        );
        await db.collection("workspaces").updateMany(
          { ownerId: user._id },
          { $set: { status: "archived", updatedAt: now } },
          { session },
        );
        await db.collection("workspaceMembers").updateMany(
          { userId: user._id },
          { $set: { status: "removed", updatedAt: now } },
          { session },
        );
        await db.collection("authSessions").deleteMany({ userId: user._id }, { session });
        await db.collection("authTokens").deleteMany({ userId: user._id }, { session });
      });
    } finally {
      await session.endSession();
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const db = await getDatabase();
    const user = await db.collection<UserDocument>("users").findOne({ _id: request.auth!.userId });
    if (!user || user.status !== "active") {
      clearSessionCookie(reply);
      return reply
        .code(401)
        .send({ error: "USER_UNAVAILABLE", message: "The authenticated user is unavailable." });
    }

    const memberships = await db
      .collection("workspaceMembers")
      .aggregate([
        { $match: { userId: user._id, status: "active" } },
        {
          $lookup: {
            from: "workspaces",
            localField: "workspaceId",
            foreignField: "_id",
            as: "workspace",
          },
        },
        { $unwind: "$workspace" },
        {
          $project: {
            _id: 0,
            id: { $toString: "$workspace._id" },
            name: "$workspace.name",
            type: "$workspace.type",
            role: 1,
          },
        },
      ])
      .toArray();

    return { user: publicUser(user), workspaces: memberships };
  });
};
