import argon2 from "argon2";
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
import { loginSchema, registerSchema } from "./schemas.js";

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
