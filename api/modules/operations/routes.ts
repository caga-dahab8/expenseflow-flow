import type { FastifyPluginAsync } from "fastify";
import { ObjectId, type Document } from "mongodb";
import { getDatabase } from "../../database/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import {
  attachmentSchema,
  importSchema,
  recurringInputSchema,
  savedReportSchema,
  searchSchema,
} from "./schemas.js";

function nextRun(date: Date, frequency: string, interval: number) {
  const result = new Date(date);
  if (frequency === "daily") result.setUTCDate(result.getUTCDate() + interval);
  else if (frequency === "weekly") result.setUTCDate(result.getUTCDate() + 7 * interval);
  else if (frequency === "monthly") result.setUTCMonth(result.getUTCMonth() + interval);
  else if (frequency === "quarterly") result.setUTCMonth(result.getUTCMonth() + 3 * interval);
  else result.setUTCFullYear(result.getUTCFullYear() + interval);
  return result;
}

function safeRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function validId(value: string) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export const operationRoutes: FastifyPluginAsync = async (app) => {
  const read = [authenticate, authorizeWorkspace];
  const write = [
    authenticate,
    authorizeWorkspace,
    requireWorkspaceRole("owner", "admin", "member"),
  ];

  app.get("/notifications", { preHandler: authenticate }, async (request) => {
    const db = await getDatabase();
    const notifications = await db
      .collection("notifications")
      .find({
        userId: request.auth!.userId,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    return {
      unread: notifications.filter((item) => !item.readAt).length,
      notifications: notifications.map((item) => ({
        id: item._id.toHexString(),
        type: item.type,
        title: item.title,
        message: item.message,
        actionUrl: item.actionUrl,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
    };
  });

  app.post("/notifications/read-all", { preHandler: authenticate }, async (request, reply) => {
    const db = await getDatabase();
    await db
      .collection("notifications")
      .updateMany(
        { userId: request.auth!.userId, readAt: { $exists: false } },
        { $set: { readAt: new Date() } },
      );
    return reply.code(204).send();
  });

  app.get("/search", { preHandler: read }, async (request) => {
    const { q } = searchSchema.parse(request.query);
    const db = await getDatabase();
    const regex = safeRegex(q);
    const [transactions, categories, reports] = await Promise.all([
      db
        .collection("transactions")
        .find({
          workspaceId: request.workspace!.id,
          deletedAt: { $exists: false },
          $or: [{ title: regex }, { description: regex }],
        })
        .sort({ transactionDate: -1 })
        .limit(8)
        .toArray(),
      db
        .collection("categories")
        .find({ workspaceId: request.workspace!.id, name: regex, status: "active" })
        .limit(6)
        .toArray(),
      db
        .collection("savedReports")
        .find({ workspaceId: request.workspace!.id, name: regex })
        .limit(6)
        .toArray(),
    ]);
    return {
      transactions: transactions.map((item) => ({
        id: item._id.toHexString(),
        title: item.title,
        amountMinor: item.amountMinor,
        currency: item.currency,
        transactionDate: item.transactionDate,
      })),
      categories: categories.map((item) => ({
        id: item._id.toHexString(),
        name: item.name,
        color: item.color,
      })),
      reports: reports.map((item) => ({
        id: item._id.toHexString(),
        name: item.name,
        reportType: item.reportType,
      })),
    };
  });

  app.get("/recurring-transactions", { preHandler: read }, async (request) => {
    const db = await getDatabase();
    const items = await db
      .collection("recurringTransactions")
      .aggregate([
        { $match: { workspaceId: request.workspace!.id } },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $set: { category: { $first: "$category" } } },
        { $sort: { nextRunAt: 1 } },
      ])
      .toArray();
    return {
      recurring: items.map((item) => ({
        id: item._id.toHexString(),
        title: item.title,
        description: item.description,
        amountMinor: item.amountMinor,
        currency: item.currency,
        frequency: item.frequency,
        interval: item.interval,
        startDate: item.startDate,
        nextRunAt: item.nextRunAt,
        autoCreate: item.autoCreate,
        status: item.status,
        category: item.category
          ? {
              id: item.category._id.toHexString(),
              name: item.category.name,
              color: item.category.color,
            }
          : null,
      })),
    };
  });

  app.post("/recurring-transactions", { preHandler: write }, async (request, reply) => {
    const input = recurringInputSchema.parse(request.body);
    const categoryId = validId(input.categoryId);
    if (!categoryId)
      return reply
        .code(400)
        .send({ error: "INVALID_CATEGORY", message: "Choose a valid category." });
    const db = await getDatabase();
    const [category, account, workspace] = await Promise.all([
      db
        .collection("categories")
        .findOne({ _id: categoryId, workspaceId: request.workspace!.id, status: "active" }),
      db
        .collection("accounts")
        .findOne({ workspaceId: request.workspace!.id, isDefault: true, status: "active" }),
      db.collection("workspaces").findOne({ _id: request.workspace!.id }),
    ]);
    if (!category || !account)
      return reply
        .code(400)
        .send({ error: "SETUP_REQUIRED", message: "A category and default account are required." });
    const now = new Date();
    const start = new Date(input.startDate);
    const result = await db.collection("recurringTransactions").insertOne({
      workspaceId: request.workspace!.id,
      accountId: account._id,
      categoryId,
      type: "expense",
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      amountMinor: input.amountMinor,
      currency: workspace?.settings?.defaultCurrency ?? account.currency,
      frequency: input.frequency,
      interval: input.interval,
      startDate: start,
      nextRunAt: start,
      autoCreate: input.autoCreate,
      status: "active",
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId.toHexString() });
  });

  app.post<{ Params: { id: string } }>(
    "/recurring-transactions/:id/run",
    { preHandler: write },
    async (request, reply) => {
      const id = validId(request.params.id);
      const db = await getDatabase();
      const item =
        id &&
        (await db
          .collection("recurringTransactions")
          .findOne({ _id: id, workspaceId: request.workspace!.id, status: "active" }));
      if (!item)
        return reply
          .code(404)
          .send({ error: "NOT_FOUND", message: "Recurring expense not found." });
      const now = new Date();
      const result = await db.collection("transactions").insertOne({
        workspaceId: item.workspaceId,
        accountId: item.accountId,
        categoryId: item.categoryId,
        type: "expense",
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        amountMinor: item.amountMinor,
        currency: item.currency,
        transactionDate: now,
        paymentMethod: "other",
        status: "completed",
        tags: [],
        recurringTransactionId: item._id,
        source: "recurring",
        createdBy: request.auth!.userId,
        createdAt: now,
        updatedAt: now,
      });
      await db.collection("recurringTransactions").updateOne(
        { _id: item._id },
        {
          $set: {
            lastRunAt: now,
            nextRunAt: nextRun(item.nextRunAt, item.frequency, item.interval),
            updatedAt: now,
          },
        },
      );
      return reply.code(201).send({ transactionId: result.insertedId.toHexString() });
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/recurring-transactions/:id",
    { preHandler: write },
    async (request, reply) => {
      const id = validId(request.params.id);
      const body = request.body as { status?: "active" | "paused" };
      if (!id || !["active", "paused"].includes(body.status ?? ""))
        return reply
          .code(400)
          .send({ error: "INVALID_REQUEST", message: "Choose an active or paused status." });
      const db = await getDatabase();
      await db
        .collection("recurringTransactions")
        .updateOne(
          { _id: id, workspaceId: request.workspace!.id },
          { $set: { status: body.status, updatedAt: new Date() } },
        );
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/recurring-transactions/:id",
    { preHandler: write },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (id)
        await (
          await getDatabase()
        )
          .collection("recurringTransactions")
          .deleteOne({ _id: id, workspaceId: request.workspace!.id });
      return reply.code(204).send();
    },
  );

  app.get("/imports", { preHandler: read }, async (request) => {
    const rows = await (
      await getDatabase()
    )
      .collection("importBatches")
      .find({ workspaceId: request.workspace!.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return {
      imports: rows.map((item) => ({
        id: item._id.toHexString(),
        fileName: item.fileName,
        status: item.status,
        totalRows: item.totalRows,
        importedRows: item.importedRows,
        failedRows: item.failedRows,
        errors: item.errors ?? [],
        createdAt: item.createdAt,
      })),
    };
  });

  app.post("/imports", { preHandler: write }, async (request, reply) => {
    const input = importSchema.parse(request.body);
    const db = await getDatabase();
    const [account, workspace, categories] = await Promise.all([
      db
        .collection("accounts")
        .findOne({ workspaceId: request.workspace!.id, isDefault: true, status: "active" }),
      db.collection("workspaces").findOne({ _id: request.workspace!.id }),
      db
        .collection("categories")
        .find({ workspaceId: request.workspace!.id, status: "active", type: "expense" })
        .toArray(),
    ]);
    if (!account)
      return reply
        .code(400)
        .send({ error: "SETUP_REQUIRED", message: "A default account is required." });
    const categoryMap = new Map(categories.map((item) => [item.name.toLowerCase(), item]));
    const fallback = categoryMap.get("other") ?? categories[0];
    if (!fallback)
      return reply
        .code(400)
        .send({ error: "SETUP_REQUIRED", message: "At least one category is required." });
    const now = new Date();
    const batchId = new ObjectId();
    const documents: Document[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    input.rows.forEach((row, index) => {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) {
        errors.push({ row: index + 2, message: "Invalid date" });
        return;
      }
      const category = categoryMap.get(row.category?.toLowerCase() ?? "") ?? fallback;
      documents.push({
        workspaceId: request.workspace!.id,
        accountId: account._id,
        categoryId: category._id,
        type: "expense",
        title: row.title,
        ...(row.description ? { description: row.description } : {}),
        amountMinor: Math.round(row.amount * 100),
        currency: workspace?.settings?.defaultCurrency ?? account.currency,
        transactionDate: date,
        paymentMethod: "other",
        status: "completed",
        tags: [],
        source: "import",
        importBatchId: batchId,
        createdBy: request.auth!.userId,
        createdAt: now,
        updatedAt: now,
      });
    });
    if (documents.length) await db.collection("transactions").insertMany(documents);
    await db.collection("importBatches").insertOne({
      _id: batchId,
      workspaceId: request.workspace!.id,
      accountId: account._id,
      fileName: input.fileName,
      source: "csv",
      status: "completed",
      totalRows: input.rows.length,
      importedRows: documents.length,
      skippedRows: 0,
      failedRows: errors.length,
      errors,
      createdBy: request.auth!.userId,
      completedAt: now,
      createdAt: now,
    });
    return reply.code(201).send({
      id: batchId.toHexString(),
      importedRows: documents.length,
      failedRows: errors.length,
      errors,
    });
  });

  app.post("/attachments", { preHandler: write }, async (request, reply) => {
    const input = attachmentSchema.parse(request.body);
    const transactionId = validId(input.transactionId);
    const db = await getDatabase();
    const transaction =
      transactionId &&
      (await db.collection("transactions").findOne({
        _id: transactionId,
        workspaceId: request.workspace!.id,
        deletedAt: { $exists: false },
      }));
    if (!transaction)
      return reply.code(404).send({ error: "NOT_FOUND", message: "Expense not found." });
    const id = new ObjectId();
    await db.collection("attachments").insertOne({
      _id: id,
      workspaceId: request.workspace!.id,
      transactionId,
      fileName: input.fileName,
      storageKey: `mongo:${id.toHexString()}`,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      dataUrl: input.dataUrl,
      uploadedBy: request.auth!.userId,
      createdAt: new Date(),
    });
    return reply.code(201).send({ id: id.toHexString() });
  });

  app.get<{ Params: { transactionId: string } }>(
    "/attachments/transaction/:transactionId",
    { preHandler: read },
    async (request) => {
      const transactionId = validId(request.params.transactionId);
      const rows = transactionId
        ? await (
            await getDatabase()
          )
            .collection("attachments")
            .find({ transactionId, workspaceId: request.workspace!.id })
            .sort({ createdAt: -1 })
            .toArray()
        : [];
      return {
        attachments: rows.map((item) => ({
          id: item._id.toHexString(),
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          dataUrl: item.dataUrl,
          createdAt: item.createdAt,
        })),
      };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/attachments/:id",
    { preHandler: write },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (id)
        await (
          await getDatabase()
        )
          .collection("attachments")
          .deleteOne({ _id: id, workspaceId: request.workspace!.id });
      return reply.code(204).send();
    },
  );

  app.get("/audit-logs", { preHandler: read }, async (request) => {
    const rows = await (
      await getDatabase()
    )
      .collection("auditLogs")
      .aggregate([
        { $match: { workspaceId: request.workspace!.id } },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        { $lookup: { from: "users", localField: "actorId", foreignField: "_id", as: "actor" } },
        { $set: { actor: { $first: "$actor" } } },
      ])
      .toArray();
    return {
      logs: rows.map((item) => ({
        id: item._id.toHexString(),
        action: item.action,
        entityType: item.entityType,
        actor: item.actor?.name ?? "System",
        createdAt: item.createdAt,
      })),
    };
  });

  app.get("/saved-reports", { preHandler: read }, async (request) => {
    const rows = await (
      await getDatabase()
    )
      .collection("savedReports")
      .find({ workspaceId: request.workspace!.id })
      .sort({ createdAt: -1 })
      .toArray();
    return {
      reports: rows.map((item) => ({
        id: item._id.toHexString(),
        name: item.name,
        reportType: item.reportType,
        filters: item.filters,
        createdAt: item.createdAt,
      })),
    };
  });

  app.post("/saved-reports", { preHandler: write }, async (request, reply) => {
    const input = savedReportSchema.parse(request.body);
    const now = new Date();
    const result = await (await getDatabase()).collection("savedReports").insertOne({
      ...input,
      workspaceId: request.workspace!.id,
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    });
    return reply.code(201).send({ id: result.insertedId.toHexString() });
  });

  app.delete<{ Params: { id: string } }>(
    "/saved-reports/:id",
    { preHandler: write },
    async (request, reply) => {
      const id = validId(request.params.id);
      if (id)
        await (
          await getDatabase()
        )
          .collection("savedReports")
          .deleteOne({ _id: id, workspaceId: request.workspace!.id });
      return reply.code(204).send();
    },
  );
};
