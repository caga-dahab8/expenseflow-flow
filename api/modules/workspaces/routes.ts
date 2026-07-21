import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase, mongoClient } from "../../database/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import { defaultCategories } from "../auth/defaults.js";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  transferOwnershipSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from "./schemas.js";

type WorkspaceDocument = {
  _id: ObjectId;
  name: string;
  type: "personal" | "family" | "business";
  ownerId: ObjectId;
  settings: { defaultCurrency: string; timezone: string; fiscalYearStartMonth: number };
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
};

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/workspaces", { preHandler: authenticate }, async (request) => {
    const db = await getDatabase();
    const workspaces = await db
      .collection("workspaceMembers")
      .aggregate([
        { $match: { userId: request.auth!.userId, status: "active" } },
        {
          $lookup: {
            from: "workspaces",
            localField: "workspaceId",
            foreignField: "_id",
            as: "workspace",
          },
        },
        { $unwind: "$workspace" },
        { $match: { "workspace.status": "active" } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$workspace._id" },
            name: "$workspace.name",
            type: "$workspace.type",
            role: 1,
            settings: "$workspace.settings",
          },
        },
        { $sort: { name: 1 } },
      ])
      .toArray();
    return { workspaces };
  });

  app.post("/workspaces", { preHandler: authenticate }, async (request, reply) => {
    const input = createWorkspaceSchema.parse(request.body);
    const db = await getDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: request.auth!.userId }, { projection: { preferences: 1 } });
    if (!user)
      return reply
        .code(401)
        .send({ error: "USER_UNAVAILABLE", message: "The authenticated user is unavailable." });

    const currency = input.currency ?? user.preferences?.currency ?? "USD";
    const timezone = input.timezone ?? user.preferences?.timezone ?? "UTC";
    const workspaceId = new ObjectId();
    const accountId = new ObjectId();
    const now = new Date();
    const session = mongoClient.startSession();

    try {
      await session.withTransaction(async () => {
        const workspace: WorkspaceDocument = {
          _id: workspaceId,
          name: input.name,
          type: input.type,
          ownerId: request.auth!.userId,
          settings: { defaultCurrency: currency, timezone, fiscalYearStartMonth: 1 },
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        await db.collection<WorkspaceDocument>("workspaces").insertOne(workspace, { session });
        await db.collection("workspaceMembers").insertOne(
          {
            workspaceId,
            userId: request.auth!.userId,
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
            currency,
            openingBalanceMinor: 0,
            currentBalanceMinor: 0,
            includeInTotals: true,
            isDefault: true,
            status: "active",
            createdBy: request.auth!.userId,
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
            createdBy: request.auth!.userId,
            createdAt: now,
            updatedAt: now,
          })),
          { session },
        );
        await db.collection("auditLogs").insertOne(
          {
            workspaceId,
            actorId: request.auth!.userId,
            action: "workspace.created",
            entityType: "workspace",
            entityId: workspaceId,
            changes: { name: input.name, type: input.type },
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

    return reply.code(201).send({
      workspace: {
        id: workspaceId.toHexString(),
        name: input.name,
        type: input.type,
        role: "owner",
        settings: { defaultCurrency: currency, timezone, fiscalYearStartMonth: 1 },
      },
    });
  });

  app.get("/workspace", { preHandler: [authenticate, authorizeWorkspace] }, async (request) => {
    const db = await getDatabase();
    const workspace = await db.collection("workspaces").findOne({ _id: request.workspace!.id });
    const members = await db
      .collection("workspaceMembers")
      .aggregate([
        { $match: { workspaceId: request.workspace!.id, status: "active" } },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
        { $set: { user: { $first: "$user" } } },
        { $sort: { role: 1, joinedAt: 1 } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            userId: { $toString: "$userId" },
            name: "$user.name",
            email: "$user.email",
            avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
            role: 1,
            joinedAt: 1,
          },
        },
      ])
      .toArray();
    const canManage = request.workspace!.role === "owner" || request.workspace!.role === "admin";
    const invitations = canManage
      ? await db
          .collection("workspaceInvitations")
          .find({ workspaceId: request.workspace!.id, status: "pending" })
          .sort({ createdAt: -1 })
          .map((invitation) => ({
            id: invitation._id.toHexString(),
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          }))
          .toArray()
      : [];
    return {
      workspace: workspace
        ? {
            id: workspace._id.toHexString(),
            name: workspace.name,
            type: workspace.type,
            role: request.workspace!.role,
            settings: workspace.settings,
          }
        : null,
      members,
      invitations,
    };
  });

  app.patch(
    "/workspace",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner", "admin")],
    },
    async (request, reply) => {
      const input = updateWorkspaceSchema.parse(request.body);
      const db = await getDatabase();
      const workspace = await db.collection("workspaces").findOne({ _id: request.workspace!.id });
      if (!workspace)
        return reply
          .code(404)
          .send({ error: "WORKSPACE_NOT_FOUND", message: "Workspace not found." });
      if (input.type === "personal" && workspace.type !== "personal") {
        const [memberCount, pendingInvitationCount] = await Promise.all([
          db.collection("workspaceMembers").countDocuments({
            workspaceId: request.workspace!.id,
            status: "active",
          }),
          db.collection("workspaceInvitations").countDocuments({
            workspaceId: request.workspace!.id,
            status: "pending",
          }),
        ]);
        if (memberCount > 1 || pendingInvitationCount > 0)
          return reply.code(409).send({
            error: "WORKSPACE_IS_SHARED",
            message:
              "Remove other members and revoke pending invitations before changing to Personal.",
          });
      }
      if (input.currency && input.currency !== workspace.settings?.defaultCurrency) {
        const financialRecords = await db
          .collection("transactions")
          .countDocuments(
            { workspaceId: request.workspace!.id, deletedAt: { $exists: false } },
            { limit: 1 },
          );
        if (financialRecords)
          return reply.code(409).send({
            error: "CURRENCY_IN_USE",
            message: "The workspace currency cannot change after expenses have been recorded.",
          });
      }
      const now = new Date();
      const changes = {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.currency ? { "settings.defaultCurrency": input.currency } : {}),
        ...(input.timezone ? { "settings.timezone": input.timezone } : {}),
        updatedAt: now,
      };
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await db
            .collection("workspaces")
            .updateOne({ _id: request.workspace!.id }, { $set: changes }, { session });
          if (input.currency)
            await db
              .collection("accounts")
              .updateMany(
                { workspaceId: request.workspace!.id },
                { $set: { currency: input.currency, updatedAt: now } },
                { session },
              );
          await db.collection("auditLogs").insertOne(
            {
              workspaceId: request.workspace!.id,
              actorId: request.auth!.userId,
              action: "workspace.updated",
              entityType: "workspace",
              entityId: request.workspace!.id,
              changes: input,
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
      return { workspace: { ...workspace, ...input, id: workspace._id.toHexString() } };
    },
  );

  app.post(
    "/workspace/invitations",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner", "admin")],
    },
    async (request, reply) => {
      const input = inviteMemberSchema.parse(request.body);
      const emailNormalized = input.email.toLowerCase();
      const db = await getDatabase();
      const workspace = await db
        .collection("workspaces")
        .findOne({ _id: request.workspace!.id, status: "active" }, { projection: { type: 1 } });
      if (!workspace)
        return reply
          .code(404)
          .send({ error: "WORKSPACE_NOT_FOUND", message: "Workspace not found." });
      if (workspace.type === "personal")
        return reply.code(409).send({
          error: "PERSONAL_WORKSPACE_PRIVATE",
          message: "Change this workspace to Family or Business before inviting members.",
        });
      const user = await db.collection("users").findOne({ emailNormalized });
      if (user) {
        const membership = await db.collection("workspaceMembers").findOne({
          workspaceId: request.workspace!.id,
          userId: user._id,
          status: "active",
        });
        if (membership)
          return reply.code(409).send({
            error: "ALREADY_MEMBER",
            message: "This person is already a workspace member.",
          });
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 14 * 86_400_000);
      const invitation = await db.collection("workspaceInvitations").findOneAndUpdate(
        { workspaceId: request.workspace!.id, emailNormalized },
        {
          $set: {
            email: input.email,
            role: input.role,
            status: "pending",
            invitedBy: request.auth!.userId,
            expiresAt,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: "after" },
      );
      return reply.code(201).send({
        invitation: {
          id: invitation!._id.toHexString(),
          email: input.email,
          role: input.role,
          expiresAt,
          createdAt: invitation!.createdAt,
        },
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/workspace/invitations/:id",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner", "admin")],
    },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id))
        return reply
          .code(400)
          .send({ error: "INVALID_INVITATION", message: "Invalid invitation." });
      await (await getDatabase()).collection("workspaceInvitations").updateOne(
        {
          _id: new ObjectId(request.params.id),
          workspaceId: request.workspace!.id,
          status: "pending",
        },
        { $set: { status: "revoked", updatedAt: new Date() } },
      );
      return reply.code(204).send();
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/workspace/members/:id",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner")],
    },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id))
        return reply.code(400).send({ error: "INVALID_MEMBER", message: "Invalid member." });
      const input = updateMemberSchema.parse(request.body);
      const db = await getDatabase();
      const result = await db.collection("workspaceMembers").updateOne(
        {
          _id: new ObjectId(request.params.id),
          workspaceId: request.workspace!.id,
          role: { $ne: "owner" },
          status: "active",
        },
        { $set: { role: input.role, updatedAt: new Date() } },
      );
      if (!result.matchedCount)
        return reply.code(404).send({ error: "MEMBER_NOT_FOUND", message: "Member not found." });
      return { member: { id: request.params.id, role: input.role } };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/workspace/members/:id",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner", "admin")],
    },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id))
        return reply.code(400).send({ error: "INVALID_MEMBER", message: "Invalid member." });
      const db = await getDatabase();
      const member = await db.collection("workspaceMembers").findOne({
        _id: new ObjectId(request.params.id),
        workspaceId: request.workspace!.id,
        status: "active",
      });
      if (!member || member.role === "owner")
        return reply.code(404).send({ error: "MEMBER_NOT_FOUND", message: "Member not found." });
      if (request.workspace!.role === "admin" && member.role === "admin")
        return reply.code(403).send({
          error: "INSUFFICIENT_ROLE",
          message: "Only the owner can remove an administrator.",
        });
      await db
        .collection("workspaceMembers")
        .updateOne({ _id: member._id }, { $set: { status: "removed", updatedAt: new Date() } });
      return reply.code(204).send();
    },
  );

  app.post(
    "/workspace/transfer-ownership",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner")],
    },
    async (request, reply) => {
      const input = transferOwnershipSchema.parse(request.body);
      if (!ObjectId.isValid(input.memberId))
        return reply.code(400).send({ error: "INVALID_MEMBER", message: "Invalid member." });
      const db = await getDatabase();
      const target = await db.collection("workspaceMembers").findOne({
        _id: new ObjectId(input.memberId),
        workspaceId: request.workspace!.id,
        status: "active",
        role: { $ne: "owner" },
      });
      if (!target)
        return reply.code(404).send({ error: "MEMBER_NOT_FOUND", message: "Member not found." });
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await db
            .collection("workspaces")
            .updateOne(
              { _id: request.workspace!.id },
              { $set: { ownerId: target.userId, updatedAt: new Date() } },
              { session },
            );
          await db
            .collection("workspaceMembers")
            .updateOne(
              { workspaceId: request.workspace!.id, userId: request.auth!.userId },
              { $set: { role: "admin", updatedAt: new Date() } },
              { session },
            );
          await db
            .collection("workspaceMembers")
            .updateOne(
              { _id: target._id },
              { $set: { role: "owner", updatedAt: new Date() } },
              { session },
            );
        });
      } finally {
        await session.endSession();
      }
      return { transferred: true };
    },
  );

  app.post(
    "/workspace/leave",
    { preHandler: [authenticate, authorizeWorkspace] },
    async (request, reply) => {
      if (request.workspace!.role === "owner")
        return reply.code(409).send({
          error: "OWNER_CANNOT_LEAVE",
          message: "Transfer ownership before leaving this workspace.",
        });
      const db = await getDatabase();
      const workspaceCount = await db.collection("workspaceMembers").countDocuments({
        userId: request.auth!.userId,
        status: "active",
      });
      if (workspaceCount <= 1)
        return reply.code(409).send({
          error: "LAST_WORKSPACE",
          message: "Create or join another workspace before leaving your only workspace.",
        });
      await db
        .collection("workspaceMembers")
        .updateOne(
          { workspaceId: request.workspace!.id, userId: request.auth!.userId, status: "active" },
          { $set: { status: "removed", updatedAt: new Date() } },
        );
      return reply.code(204).send();
    },
  );

  app.delete(
    "/workspace",
    {
      preHandler: [authenticate, authorizeWorkspace, requireWorkspaceRole("owner")],
    },
    async (request, reply) => {
      const db = await getDatabase();
      const workspaceCount = await db.collection("workspaceMembers").countDocuments({
        userId: request.auth!.userId,
        status: "active",
      });
      if (workspaceCount <= 1)
        return reply.code(409).send({
          error: "LAST_WORKSPACE",
          message: "Create another workspace before deleting your only workspace.",
        });
      const now = new Date();
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await db
            .collection("workspaces")
            .updateOne(
              { _id: request.workspace!.id },
              { $set: { status: "archived", updatedAt: now } },
              { session },
            );
          await db
            .collection("workspaceMembers")
            .updateMany(
              { workspaceId: request.workspace!.id, status: "active" },
              { $set: { status: "removed", updatedAt: now } },
              { session },
            );
          await db
            .collection("workspaceInvitations")
            .updateMany(
              { workspaceId: request.workspace!.id, status: "pending" },
              { $set: { status: "revoked", updatedAt: now } },
              { session },
            );
        });
      } finally {
        await session.endSession();
      }
      return reply.code(204).send();
    },
  );

  app.get("/workspace-invitations", { preHandler: authenticate }, async (request) => {
    const db = await getDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: request.auth!.userId }, { projection: { emailNormalized: 1 } });
    if (!user) return { invitations: [] };
    const invitations = await db
      .collection("workspaceInvitations")
      .aggregate([
        {
          $match: {
            emailNormalized: user.emailNormalized,
            status: "pending",
            expiresAt: { $gt: new Date() },
          },
        },
        {
          $lookup: {
            from: "workspaces",
            localField: "workspaceId",
            foreignField: "_id",
            as: "workspace",
          },
        },
        { $set: { workspace: { $first: "$workspace" } } },
        { $match: { "workspace.status": "active" } },
        {
          $lookup: {
            from: "workspaceMembers",
            let: { workspaceId: "$workspaceId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$workspaceId", "$$workspaceId"] },
                      { $eq: ["$userId", request.auth!.userId] },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "existingMembership",
          },
        },
        { $match: { existingMembership: { $eq: [] } } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            role: 1,
            expiresAt: 1,
            workspace: {
              id: { $toString: "$workspace._id" },
              name: "$workspace.name",
              type: "$workspace.type",
            },
          },
        },
      ])
      .toArray();
    return { invitations };
  });

  app.post<{ Params: { id: string } }>(
    "/workspace-invitations/:id/accept",
    { preHandler: authenticate },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id))
        return reply
          .code(400)
          .send({ error: "INVALID_INVITATION", message: "Invalid invitation." });
      const db = await getDatabase();
      const user = await db.collection("users").findOne({ _id: request.auth!.userId });
      const invitation = user
        ? await db.collection("workspaceInvitations").findOne({
            _id: new ObjectId(request.params.id),
            emailNormalized: user.emailNormalized,
            status: "pending",
            expiresAt: { $gt: new Date() },
          })
        : null;
      if (!invitation)
        return reply
          .code(404)
          .send({ error: "INVITATION_NOT_FOUND", message: "Invitation not found or expired." });
      const existingMembership = await db.collection("workspaceMembers").findOne({
        workspaceId: invitation.workspaceId,
        userId: request.auth!.userId,
        status: "active",
      });
      if (existingMembership) {
        await db
          .collection("workspaceInvitations")
          .updateOne(
            { _id: invitation._id, status: "pending" },
            { $set: { status: "revoked", updatedAt: new Date() } },
          );
        return reply.code(409).send({
          error: "ALREADY_MEMBER",
          message: "You already have access to this workspace.",
        });
      }
      const now = new Date();
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await db.collection("workspaceMembers").updateOne(
            {
              workspaceId: invitation.workspaceId,
              userId: request.auth!.userId,
              status: { $ne: "active" },
            },
            {
              $set: { role: invitation.role, status: "active", joinedAt: now, updatedAt: now },
              $setOnInsert: { invitedBy: invitation.invitedBy, createdAt: now },
            },
            { upsert: true, session },
          );
          await db.collection("workspaceInvitations").updateOne(
            { _id: invitation._id },
            {
              $set: {
                status: "accepted",
                acceptedBy: request.auth!.userId,
                acceptedAt: now,
                updatedAt: now,
              },
            },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      return { workspaceId: invitation.workspaceId.toHexString() };
    },
  );
};
