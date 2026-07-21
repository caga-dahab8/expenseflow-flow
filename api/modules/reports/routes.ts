import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDatabase } from "../../database/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace } from "../../middleware/authorize-workspace.js";

const reportQuerySchema = z
  .object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((value) => value.start <= value.end, {
    message: "The start date must be before the end date.",
    path: ["start"],
  });

function parseRange(query: unknown) {
  const input = reportQuerySchema.parse(query);
  const start = new Date(`${input.start}T00:00:00.000Z`);
  const endExclusive = new Date(`${input.end}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (endExclusive.getTime() - start.getTime() > 5 * 366 * 86_400_000) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Reports can cover at most five years.",
        path: ["end"],
      },
    ]);
  }
  return { input, start, endExclusive };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  const handlers = [authenticate, authorizeWorkspace];

  app.get("/reports", { preHandler: handlers }, async (request) => {
    const { input, start, endExclusive } = parseRange(request.query);
    const db = await getDatabase();
    const workspace = await db
      .collection("workspaces")
      .findOne({ _id: request.workspace!.id }, { projection: { settings: 1 } });
    const currency = workspace?.settings?.defaultCurrency ?? "USD";
    const timeZone = workspace?.settings?.timezone ?? "UTC";
    const heatmapStart = new Date(
      Math.max(start.getTime(), endExclusive.getTime() - 140 * 86_400_000),
    );
    const match = {
      workspaceId: request.workspace!.id,
      type: "expense",
      currency,
      status: "completed",
      deletedAt: { $exists: false },
      transactionDate: { $gte: start, $lt: endExclusive },
    };

    const [result, budgets] = await Promise.all([
      db
        .collection("transactions")
        .aggregate([
          { $match: match },
          {
            $facet: {
              summary: [
                {
                  $group: {
                    _id: null,
                    totalMinor: { $sum: "$amountMinor" },
                    transactionCount: { $sum: 1 },
                    averageMinor: { $avg: "$amountMinor" },
                  },
                },
              ],
              monthly: [
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        date: "$transactionDate",
                        format: "%Y-%m",
                        timezone: timeZone,
                      },
                    },
                    amountMinor: { $sum: "$amountMinor" },
                    transactionCount: { $sum: 1 },
                  },
                },
                { $sort: { _id: 1 } },
              ],
              weekdays: [
                {
                  $group: {
                    _id: { $dayOfWeek: { date: "$transactionDate", timezone: timeZone } },
                    amountMinor: { $sum: "$amountMinor" },
                    transactionCount: { $sum: 1 },
                  },
                },
              ],
              categories: [
                {
                  $group: {
                    _id: "$categoryId",
                    totalMinor: { $sum: "$amountMinor" },
                    transactionCount: { $sum: 1 },
                  },
                },
                { $sort: { totalMinor: -1 } },
                {
                  $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category",
                  },
                },
                { $set: { category: { $first: "$category" } } },
                {
                  $project: {
                    _id: 0,
                    id: { $toString: "$_id" },
                    name: { $ifNull: ["$category.name", "Archived category"] },
                    color: { $ifNull: ["$category.color", "slate"] },
                    totalMinor: 1,
                    transactionCount: 1,
                  },
                },
              ],
              daily: [
                { $match: { transactionDate: { $gte: heatmapStart } } },
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        date: "$transactionDate",
                        format: "%Y-%m-%d",
                        timezone: timeZone,
                      },
                    },
                    amountMinor: { $sum: "$amountMinor" },
                  },
                },
                { $sort: { _id: 1 } },
              ],
              topExpenses: [
                { $sort: { amountMinor: -1, transactionDate: -1 } },
                { $limit: 10 },
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
                  $project: {
                    _id: 0,
                    id: { $toString: "$_id" },
                    title: 1,
                    amountMinor: 1,
                    transactionDate: 1,
                    category: {
                      id: { $toString: "$category._id" },
                      name: { $ifNull: ["$category.name", "Archived category"] },
                      color: { $ifNull: ["$category.color", "slate"] },
                    },
                  },
                },
              ],
            },
          },
        ])
        .next(),
      db
        .collection("budgets")
        .aggregate([
          {
            $match: {
              workspaceId: request.workspace!.id,
              currency,
              status: "active",
              startDate: { $lt: endExclusive },
              endDate: { $gte: start },
            },
          },
          {
            $lookup: {
              from: "transactions",
              let: {
                workspace: "$workspaceId",
                category: "$categoryId",
                currency: "$currency",
                start: { $cond: [{ $gt: ["$startDate", start] }, "$startDate", start] },
                end: { $cond: [{ $lt: ["$endDate", endExclusive] }, "$endDate", endExclusive] },
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
                        { $gte: ["$transactionDate", "$$start"] },
                        { $lt: ["$transactionDate", "$$end"] },
                        { $eq: [{ $type: "$deletedAt" }, "missing"] },
                      ],
                    },
                  },
                },
                { $group: { _id: null, amountMinor: { $sum: "$amountMinor" } } },
              ],
              as: "spending",
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "categoryId",
              foreignField: "_id",
              as: "category",
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              amountMinor: 1,
              spentMinor: { $ifNull: [{ $first: "$spending.amountMinor" }, 0] },
              category: {
                id: { $toString: { $first: "$category._id" } },
                name: { $ifNull: [{ $first: "$category.name" }, "$name"] },
                color: { $ifNull: [{ $first: "$category.color" }, "slate"] },
              },
            },
          },
          { $sort: { spentMinor: -1 } },
        ])
        .toArray(),
    ]);

    const data = result ?? {
      summary: [],
      monthly: [],
      weekdays: [],
      categories: [],
      daily: [],
      topExpenses: [],
    };
    const summary = data.summary[0] ?? {
      totalMinor: 0,
      transactionCount: 0,
      averageMinor: 0,
    };
    const days = Math.max(1, Math.ceil((endExclusive.getTime() - start.getTime()) / 86_400_000));
    const weekdayMap = new Map<
      number,
      { _id: number; amountMinor: number; transactionCount: number }
    >(
      data.weekdays.map((item: { _id: number; amountMinor: number; transactionCount: number }) => [
        item._id,
        item,
      ]),
    );
    const weekdayOrder = [2, 3, 4, 5, 6, 7, 1];
    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return {
      currency,
      timeZone,
      range: input,
      summary: {
        ...summary,
        averageMinor: Math.round(summary.averageMinor ?? 0),
        averageDailyMinor: Math.round(summary.totalMinor / days),
      },
      monthly: data.monthly.map(
        (item: { _id: string; amountMinor: number; transactionCount: number }) => ({
          key: item._id,
          amountMinor: item.amountMinor,
          transactionCount: item.transactionCount,
        }),
      ),
      weekdays: weekdayOrder.map((key, index) => ({
        key,
        label: weekdayNames[index],
        amountMinor: weekdayMap.get(key)?.amountMinor ?? 0,
        transactionCount: weekdayMap.get(key)?.transactionCount ?? 0,
      })),
      categories: data.categories,
      daily: data.daily.map((item: { _id: string; amountMinor: number }) => ({
        key: item._id,
        amountMinor: item.amountMinor,
      })),
      topExpenses: data.topExpenses,
      budgets,
    };
  });

  app.get("/reports/export.csv", { preHandler: handlers }, async (request, reply) => {
    const { input, start, endExclusive } = parseRange(request.query);
    const db = await getDatabase();
    const workspace = await db
      .collection("workspaces")
      .findOne({ _id: request.workspace!.id }, { projection: { settings: 1 } });
    const currency = workspace?.settings?.defaultCurrency ?? "USD";
    const rows = await db
      .collection("transactions")
      .aggregate([
        {
          $match: {
            workspaceId: request.workspace!.id,
            type: "expense",
            currency,
            status: "completed",
            deletedAt: { $exists: false },
            transactionDate: { $gte: start, $lt: endExclusive },
          },
        },
        { $sort: { transactionDate: -1, _id: -1 } },
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
          $project: {
            _id: 0,
            title: 1,
            description: 1,
            transactionDate: 1,
            amountMinor: 1,
            category: "$category.name",
          },
        },
      ])
      .toArray();
    const csv = [
      ["Date", "Expense", "Category", "Description", "Amount", "Currency"],
      ...rows.map((row) => [
        row.transactionDate.toISOString().slice(0, 10),
        row.title,
        row.category ?? "Archived category",
        row.description ?? "",
        (row.amountMinor / 100).toFixed(2),
        currency,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        `attachment; filename="expenseflow-${input.start}-to-${input.end}.csv"`,
      )
      .send(`\uFEFF${csv}`);
  });
};
