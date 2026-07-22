import type { FastifyPluginAsync } from "fastify";
import { ObjectId, type Filter } from "mongodb";
import { getDatabase, mongoClient } from "../../database/client.js";
import { writeAuditLog } from "../../lib/audit.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import {
  createTransactionSchema,
  transactionQuerySchema,
  updateTransactionSchema,
} from "./schemas.js";

type TransactionDocument = {
  _id: ObjectId;
  workspaceId: ObjectId;
  accountId: ObjectId;
  categoryId: ObjectId;
  type: "expense";
  title: string;
  description?: string;
  amountMinor: number;
  currency: string;
  transactionDate: Date;
  paymentMethod: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  merchant?: string;
  reference?: string;
  tags: string[];
  source: "manual";
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const readHandlers = [authenticate, authorizeWorkspace];
const writeHandlers = [...readHandlers, requireWorkspaceRole("owner", "admin", "member")];

function validId(value: string) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

function balanceEffect(transaction: Pick<TransactionDocument, "amountMinor" | "status">) {
  return transaction.status === "completed" ? -transaction.amountMinor : 0;
}

async function validateReferences(
  workspaceId: ObjectId,
  accountId: ObjectId,
  categoryId: ObjectId,
) {
  const db = await getDatabase();
  const [account, category] = await Promise.all([
    db
      .collection("accounts")
      .findOne({ _id: accountId, workspaceId, status: "active" }, { projection: { currency: 1 } }),
    db
      .collection("categories")
      .findOne(
        { _id: categoryId, workspaceId, type: "expense", status: "active" },
        { projection: { _id: 1 } },
      ),
  ]);
  return { account, category };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/transactions", { preHandler: readHandlers }, async (request, reply) => {
    const query = transactionQuerySchema.parse(request.query);
    const filter: Filter<TransactionDocument> = {
      workspaceId: request.workspace!.id,
      type: "expense",
      deletedAt: { $exists: false },
    };
    if (query.search) filter.$text = { $search: query.search };
    if (query.status) filter.status = query.status;
    if (query.categoryId) {
      const id = validId(query.categoryId);
      if (!id)
        return reply
          .code(400)
          .send({ error: "INVALID_CATEGORY", message: "The category identifier is invalid." });
      filter.categoryId = id;
    }
    if (query.accountId) {
      const id = validId(query.accountId);
      if (!id)
        return reply
          .code(400)
          .send({ error: "INVALID_ACCOUNT", message: "The account identifier is invalid." });
      filter.accountId = id;
    }

    const db = await getDatabase();
    const sort =
      query.sort === "amount"
        ? { amountMinor: -1 as const, transactionDate: -1 as const }
        : { transactionDate: -1 as const, _id: -1 as const };
    const [transactions, total] = await Promise.all([
      db
        .collection<TransactionDocument>("transactions")
        .aggregate([
          { $match: filter },
          { $sort: sort },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          {
            $lookup: {
              from: "categories",
              localField: "categoryId",
              foreignField: "_id",
              as: "category",
            },
          },
          {
            $lookup: {
              from: "accounts",
              localField: "accountId",
              foreignField: "_id",
              as: "account",
            },
          },
          { $set: { category: { $first: "$category" }, account: { $first: "$account" } } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              title: 1,
              description: 1,
              amountMinor: 1,
              currency: 1,
              transactionDate: 1,
              paymentMethod: 1,
              status: 1,
              merchant: 1,
              reference: 1,
              tags: 1,
              account: { id: { $toString: "$account._id" }, name: "$account.name" },
              category: {
                id: { $toString: "$category._id" },
                name: "$category.name",
                color: "$category.color",
                icon: "$category.icon",
              },
            },
          },
        ])
        .toArray(),
      db.collection<TransactionDocument>("transactions").countDocuments(filter),
    ]);
    return {
      transactions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  });

  app.get<{ Params: { id: string } }>(
    "/transactions/:id",
    { preHandler: readHandlers },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (!id)
        return reply.code(400).send({
          error: "INVALID_TRANSACTION",
          message: "The transaction identifier is invalid.",
        });
      const db = await getDatabase();
      const transaction = await db
        .collection<TransactionDocument>("transactions")
        .findOne({ _id: id, workspaceId: request.workspace!.id, deletedAt: { $exists: false } });
      if (!transaction)
        return reply
          .code(404)
          .send({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found." });
      return { transaction: { ...transaction, id: transaction._id.toHexString(), _id: undefined } };
    },
  );

  app.post("/transactions", { preHandler: writeHandlers }, async (request, reply) => {
    const input = createTransactionSchema.parse(request.body);
    const categoryId = validId(input.categoryId);
    if (!categoryId)
      return reply
        .code(400)
        .send({ error: "INVALID_CATEGORY", message: "Select a valid expense category." });
    const db = await getDatabase();
    const defaultAccount = await db
      .collection("accounts")
      .findOne(
        { workspaceId: request.workspace!.id, status: "active" },
        { sort: { isDefault: -1, createdAt: 1 }, projection: { currency: 1 } },
      );
    if (!defaultAccount)
      return reply.code(400).send({
        error: "DEFAULT_ACCOUNT_UNAVAILABLE",
        message: "This workspace does not have an active default account.",
      });
    const accountId = defaultAccount._id;
    const { account, category } = await validateReferences(
      request.workspace!.id,
      accountId,
      categoryId,
    );
    if (!account || !category)
      return reply.code(400).send({
        error: "INVALID_REFERENCE",
        message: "The account or category is unavailable in this workspace.",
      });
    const id = new ObjectId();
    const now = new Date();
    const { categoryId: _category, transactionDate, ...fields } = input;
    const transaction: TransactionDocument = {
      _id: id,
      workspaceId: request.workspace!.id,
      accountId,
      categoryId,
      type: "expense",
      ...fields,
      currency: account.currency,
      transactionDate: new Date(transactionDate),
      paymentMethod: "other",
      status: "completed",
      source: "manual",
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    };
    const session = mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        await db
          .collection<TransactionDocument>("transactions")
          .insertOne(transaction, { session });
        const effect = balanceEffect(transaction);
        if (effect)
          await db
            .collection("accounts")
            .updateOne(
              { _id: accountId, workspaceId: request.workspace!.id },
              { $inc: { currentBalanceMinor: effect }, $set: { updatedAt: now } },
              { session },
            );
        await db.collection("auditLogs").insertOne(
          {
            workspaceId: request.workspace!.id,
            actorId: request.auth!.userId,
            action: "transaction.created",
            entityType: "transaction",
            entityId: id,
            changes: { title: input.title, amountMinor: input.amountMinor },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
            createdAt: now,
          },
          { session },
        );
        const recipients = await db
          .collection("workspaceMembers")
          .find(
            {
              workspaceId: request.workspace!.id,
              status: "active",
              userId: { $ne: request.auth!.userId },
            },
            { session, projection: { userId: 1 } },
          )
          .toArray();
        if (recipients.length) {
          await db.collection("notifications").insertMany(
            recipients.map((member) => ({
              userId: member.userId,
              workspaceId: request.workspace!.id,
              type: "transaction_created",
              title: "New workspace expense",
              message: `${input.title} was added to the workspace.`,
              actionUrl: "/expenses",
              createdAt: now,
            })),
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return reply
      .code(201)
      .send({ transaction: { id: id.toHexString(), ...transaction, _id: undefined } });
  });

  app.patch<{ Params: { id: string } }>(
    "/transactions/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (!id)
        return reply.code(400).send({
          error: "INVALID_TRANSACTION",
          message: "The transaction identifier is invalid.",
        });
      const input = updateTransactionSchema.parse(request.body);
      const db = await getDatabase();
      const existing = await db
        .collection<TransactionDocument>("transactions")
        .findOne({ _id: id, workspaceId: request.workspace!.id, deletedAt: { $exists: false } });
      if (!existing)
        return reply
          .code(404)
          .send({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found." });
      const accountId = existing.accountId;
      const categoryId = input.categoryId ? validId(input.categoryId) : existing.categoryId;
      if (!categoryId)
        return reply
          .code(400)
          .send({ error: "INVALID_CATEGORY", message: "Select a valid expense category." });
      const { account, category } = await validateReferences(
        request.workspace!.id,
        accountId,
        categoryId,
      );
      if (!account || !category)
        return reply.code(400).send({
          error: "INVALID_REFERENCE",
          message: "The account or category is unavailable in this workspace.",
        });
      const currency = existing.currency;
      if (account.currency !== currency)
        return reply.code(400).send({
          error: "CURRENCY_MISMATCH",
          message: "The transaction currency must match the account currency.",
        });

      const { categoryId: _category, transactionDate, ...fields } = input;
      const updated: TransactionDocument = {
        ...existing,
        ...fields,
        accountId,
        categoryId,
        currency,
        ...(transactionDate ? { transactionDate: new Date(transactionDate) } : {}),
        updatedBy: request.auth!.userId,
        updatedAt: new Date(),
      };
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          const oldEffect = balanceEffect(existing);
          const newEffect = balanceEffect(updated);
          if (oldEffect)
            await db.collection("accounts").updateOne(
              { _id: existing.accountId, workspaceId: request.workspace!.id },
              {
                $inc: { currentBalanceMinor: -oldEffect },
                $set: { updatedAt: updated.updatedAt },
              },
              { session },
            );
          if (newEffect)
            await db.collection("accounts").updateOne(
              { _id: updated.accountId, workspaceId: request.workspace!.id },
              {
                $inc: { currentBalanceMinor: newEffect },
                $set: { updatedAt: updated.updatedAt },
              },
              { session },
            );
          await db
            .collection<TransactionDocument>("transactions")
            .replaceOne({ _id: id, workspaceId: request.workspace!.id }, updated, { session });
          await db.collection("auditLogs").insertOne(
            {
              workspaceId: request.workspace!.id,
              actorId: request.auth!.userId,
              action: "transaction.updated",
              entityType: "transaction",
              entityId: id,
              changes: input,
              ipAddress: request.ip,
              userAgent: request.headers["user-agent"],
              createdAt: updated.updatedAt,
            },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      return { transaction: { id: id.toHexString(), ...updated, _id: undefined } };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/transactions/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (!id)
        return reply.code(400).send({
          error: "INVALID_TRANSACTION",
          message: "The transaction identifier is invalid.",
        });
      const db = await getDatabase();
      const existing = await db
        .collection<TransactionDocument>("transactions")
        .findOne({ _id: id, workspaceId: request.workspace!.id, deletedAt: { $exists: false } });
      if (!existing)
        return reply
          .code(404)
          .send({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found." });
      const now = new Date();
      const session = mongoClient.startSession();
      try {
        await session.withTransaction(async () => {
          await db
            .collection("transactions")
            .updateOne(
              { _id: id, workspaceId: request.workspace!.id },
              { $set: { deletedAt: now, updatedAt: now, updatedBy: request.auth!.userId } },
              { session },
            );
          const effect = balanceEffect(existing);
          if (effect)
            await db
              .collection("accounts")
              .updateOne(
                { _id: existing.accountId, workspaceId: request.workspace!.id },
                { $inc: { currentBalanceMinor: -effect }, $set: { updatedAt: now } },
                { session },
              );
          await db.collection("auditLogs").insertOne(
            {
              workspaceId: request.workspace!.id,
              actorId: request.auth!.userId,
              action: "transaction.deleted",
              entityType: "transaction",
              entityId: id,
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
      return reply.code(204).send();
    },
  );
};
