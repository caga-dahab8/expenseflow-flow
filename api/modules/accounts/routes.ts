import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../database/client.js";
import { writeAuditLog } from "../../lib/audit.js";
import { serializeId } from "../../lib/serialize.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import { createAccountSchema, updateAccountSchema } from "./schemas.js";

type AccountDocument = {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  type: string;
  institution?: string;
  currency: string;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  lastFourDigits?: string;
  color?: string;
  icon?: string;
  includeInTotals: boolean;
  isDefault: boolean;
  status: "active" | "archived";
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const baseHandlers = [authenticate, authorizeWorkspace];
const writeHandlers = [...baseHandlers, requireWorkspaceRole("owner", "admin", "member")];

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/accounts", { preHandler: baseHandlers }, async (request) => {
    const db = await getDatabase();
    const accounts = await db
      .collection<AccountDocument>("accounts")
      .find({ workspaceId: request.workspace!.id })
      .sort({ status: 1, isDefault: -1, name: 1 })
      .toArray();
    return { accounts: accounts.map(serializeId) };
  });

  app.post("/accounts", { preHandler: writeHandlers }, async (request, reply) => {
    const input = createAccountSchema.parse(request.body);
    const db = await getDatabase();
    const now = new Date();
    const id = new ObjectId();

    if (input.isDefault) {
      await db
        .collection("accounts")
        .updateMany(
          { workspaceId: request.workspace!.id, isDefault: true },
          { $set: { isDefault: false, updatedAt: now } },
        );
    }

    const account: AccountDocument = {
      _id: id,
      workspaceId: request.workspace!.id,
      ...input,
      currentBalanceMinor: input.openingBalanceMinor,
      status: "active",
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<AccountDocument>("accounts").insertOne(account);
    await writeAuditLog(db, {
      workspaceId: request.workspace!.id,
      actorId: request.auth!.userId,
      action: "account.created",
      entityType: "account",
      entityId: id,
      changes: { name: input.name, type: input.type },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.code(201).send({ account: serializeId(account) });
  });

  app.patch<{ Params: { id: string } }>(
    "/accounts/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id)) {
        return reply
          .code(400)
          .send({ error: "INVALID_ACCOUNT", message: "The account identifier is invalid." });
      }
      const input = updateAccountSchema.parse(request.body);
      const db = await getDatabase();
      const id = new ObjectId(request.params.id);
      const now = new Date();

      if (input.isDefault) {
        await db
          .collection("accounts")
          .updateMany(
            { workspaceId: request.workspace!.id, _id: { $ne: id }, isDefault: true },
            { $set: { isDefault: false, updatedAt: now } },
          );
      }

      const account = await db
        .collection<AccountDocument>("accounts")
        .findOneAndUpdate(
          { _id: id, workspaceId: request.workspace!.id },
          { $set: { ...input, updatedAt: now } },
          { returnDocument: "after" },
        );
      if (!account)
        return reply.code(404).send({ error: "ACCOUNT_NOT_FOUND", message: "Account not found." });

      await writeAuditLog(db, {
        workspaceId: request.workspace!.id,
        actorId: request.auth!.userId,
        action: input.status === "archived" ? "account.archived" : "account.updated",
        entityType: "account",
        entityId: id,
        changes: input,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return { account: serializeId(account) };
    },
  );
};
