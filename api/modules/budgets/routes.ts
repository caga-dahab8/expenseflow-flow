import type { FastifyPluginAsync } from "fastify";
import { ObjectId, type Filter } from "mongodb";
import { getDatabase } from "../../database/client.js";
import { writeAuditLog } from "../../lib/audit.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import { budgetQuerySchema, createBudgetSchema, updateBudgetSchema } from "./schemas.js";

type BudgetDocument = {
  _id: ObjectId;
  workspaceId: ObjectId;
  categoryId: ObjectId;
  name: string;
  amountMinor: number;
  currency: string;
  period: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  startDate: Date;
  endDate: Date;
  rollover: boolean;
  alerts: Array<{ percentage: number; enabled: boolean }>;
  status: "active" | "paused" | "archived";
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const readHandlers = [authenticate, authorizeWorkspace];
const writeHandlers = [...readHandlers, requireWorkspaceRole("owner", "admin")];

function monthRange(value?: string) {
  const source = value ? new Date(`${value}-01T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
  const end = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 1));
  return { start, end };
}

function budgetId(value: string) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

async function expenseCategory(workspaceId: ObjectId, id: ObjectId) {
  return (await getDatabase()).collection("categories").findOne({
    _id: id,
    workspaceId,
    type: "expense",
    status: "active",
  });
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  app.get("/budgets", { preHandler: readHandlers }, async (request) => {
    const query = budgetQuerySchema.parse(request.query);
    const range = monthRange(query.month);
    const filter: Filter<BudgetDocument> = {
      workspaceId: request.workspace!.id,
      startDate: { $lt: range.end },
      endDate: { $gte: range.start },
      ...(query.status ? { status: query.status } : { status: { $ne: "archived" } }),
    };
    const db = await getDatabase();
    const budgets = await db
      .collection<BudgetDocument>("budgets")
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $set: { category: { $first: "$category" } } },
        {
          $lookup: {
            from: "transactions",
            let: {
              workspace: "$workspaceId",
              category: "$categoryId",
              currency: "$currency",
              budgetStart: "$startDate",
              budgetEnd: "$endDate",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$workspaceId", "$$workspace"] },
                      { $eq: ["$categoryId", "$$category"] },
                      { $eq: ["$currency", "$$currency"] },
                      { $eq: ["$type", "expense"] },
                      { $eq: ["$status", "completed"] },
                      { $gte: ["$transactionDate", "$$budgetStart"] },
                      { $lte: ["$transactionDate", "$$budgetEnd"] },
                      { $eq: [{ $type: "$deletedAt" }, "missing"] },
                    ],
                  },
                },
              },
              { $group: { _id: null, total: { $sum: "$amountMinor" } } },
            ],
            as: "spending",
          },
        },
        { $set: { spentMinor: { $ifNull: [{ $first: "$spending.total" }, 0] } } },
        { $sort: { startDate: -1, name: 1 } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            name: 1,
            amountMinor: 1,
            spentMinor: 1,
            currency: 1,
            period: 1,
            startDate: 1,
            endDate: 1,
            rollover: 1,
            alerts: 1,
            status: 1,
            category: {
              id: { $toString: "$category._id" },
              name: "$category.name",
              color: "$category.color",
              icon: "$category.icon",
            },
          },
        },
      ])
      .toArray();
    return { budgets, month: range.start.toISOString().slice(0, 7) };
  });

  app.post("/budgets", { preHandler: writeHandlers }, async (request, reply) => {
    const input = createBudgetSchema.parse(request.body);
    const categoryId = budgetId(input.categoryId);
    if (!categoryId || !(await expenseCategory(request.workspace!.id, categoryId))) {
      return reply.code(400).send({
        error: "INVALID_CATEGORY",
        message: "Select an active expense category from this workspace.",
      });
    }
    const db = await getDatabase();
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const duplicate = await db.collection<BudgetDocument>("budgets").findOne({
      workspaceId: request.workspace!.id,
      categoryId,
      startDate,
      endDate,
      status: { $ne: "archived" },
    });
    if (duplicate) {
      return reply.code(409).send({
        error: "BUDGET_EXISTS",
        message: "This category already has a budget for the selected period.",
      });
    }
    const now = new Date();
    const id = new ObjectId();
    const { categoryId: _categoryId, startDate: _start, endDate: _end, ...fields } = input;
    const budget: BudgetDocument = {
      _id: id,
      workspaceId: request.workspace!.id,
      categoryId,
      ...fields,
      startDate,
      endDate,
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<BudgetDocument>("budgets").insertOne(budget);
    await writeAuditLog(db, {
      workspaceId: request.workspace!.id,
      actorId: request.auth!.userId,
      action: "budget.created",
      entityType: "budget",
      entityId: id,
      changes: { name: budget.name, amountMinor: budget.amountMinor },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.code(201).send({ budget: { ...budget, id: id.toHexString(), _id: undefined } });
  });

  app.patch<{ Params: { id: string } }>(
    "/budgets/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      const id = budgetId(request.params.id);
      if (!id)
        return reply.code(400).send({
          error: "INVALID_BUDGET",
          message: "The budget identifier is invalid.",
        });
      const input = updateBudgetSchema.parse(request.body);
      const db = await getDatabase();
      const existing = await db
        .collection<BudgetDocument>("budgets")
        .findOne({ _id: id, workspaceId: request.workspace!.id });
      if (!existing)
        return reply.code(404).send({ error: "BUDGET_NOT_FOUND", message: "Budget not found." });
      const categoryId = input.categoryId ? budgetId(input.categoryId) : existing.categoryId;
      if (!categoryId || !(await expenseCategory(request.workspace!.id, categoryId))) {
        return reply.code(400).send({
          error: "INVALID_CATEGORY",
          message: "Select an active expense category from this workspace.",
        });
      }
      const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
      const endDate = input.endDate ? new Date(input.endDate) : existing.endDate;
      if (endDate < startDate)
        return reply.code(400).send({
          error: "INVALID_PERIOD",
          message: "End date must be on or after the start date.",
        });
      const duplicate = await db.collection<BudgetDocument>("budgets").findOne({
        _id: { $ne: id },
        workspaceId: request.workspace!.id,
        categoryId,
        startDate,
        endDate,
        status: { $ne: "archived" },
      });
      if (duplicate)
        return reply.code(409).send({
          error: "BUDGET_EXISTS",
          message: "This category already has a budget for the selected period.",
        });
      const { categoryId: _category, startDate: _start, endDate: _end, ...fields } = input;
      const changes = {
        ...fields,
        categoryId,
        startDate,
        endDate,
        updatedBy: request.auth!.userId,
        updatedAt: new Date(),
      };
      const budget = await db
        .collection<BudgetDocument>("budgets")
        .findOneAndUpdate(
          { _id: id, workspaceId: request.workspace!.id },
          { $set: changes },
          { returnDocument: "after" },
        );
      await writeAuditLog(db, {
        workspaceId: request.workspace!.id,
        actorId: request.auth!.userId,
        action: "budget.updated",
        entityType: "budget",
        entityId: id,
        changes: input,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return { budget: { ...budget!, id: id.toHexString(), _id: undefined } };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/budgets/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      const id = budgetId(request.params.id);
      if (!id)
        return reply.code(400).send({
          error: "INVALID_BUDGET",
          message: "The budget identifier is invalid.",
        });
      const db = await getDatabase();
      const result = await db.collection<BudgetDocument>("budgets").deleteOne({
        _id: id,
        workspaceId: request.workspace!.id,
      });
      if (!result.deletedCount)
        return reply.code(404).send({ error: "BUDGET_NOT_FOUND", message: "Budget not found." });
      await writeAuditLog(db, {
        workspaceId: request.workspace!.id,
        actorId: request.auth!.userId,
        action: "budget.deleted",
        entityType: "budget",
        entityId: id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return reply.code(204).send();
    },
  );
};
