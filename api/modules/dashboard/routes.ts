import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../../database/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace } from "../../middleware/authorize-workspace.js";
import { materializeDueRecurring } from "../operations/recurring.js";

function dateKey(date: Date, timeZone: string, includeDay = false) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    ...(includeDay ? { day: "2-digit" } : {}),
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return includeDay
    ? `${value("year")}-${value("month")}-${value("day")}`
    : `${value("year")}-${value("month")}`;
}

function monthKeys(now: Date, timeZone: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 15),
    );
    return dateKey(date, timeZone);
  });
}

function dayKeys(now: Date, timeZone: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getTime() - (count - 1 - index) * 86_400_000);
    return dateKey(date, timeZone, true);
  });
}

function previousMonthKey(current: string) {
  const [year, month] = current.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1_000) / 10;
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard", { preHandler: [authenticate, authorizeWorkspace] }, async (request) => {
    const db = await getDatabase();
    await materializeDueRecurring(db, request.workspace!.id);
    const workspace = await db
      .collection("workspaces")
      .findOne({ _id: request.workspace!.id }, { projection: { settings: 1 } });
    const currency = workspace?.settings?.defaultCurrency ?? "USD";
    const timeZone = workspace?.settings?.timezone ?? "UTC";
    const now = new Date();
    const currentMonth = dateKey(now, timeZone);
    const previousMonth = previousMonthKey(currentMonth);
    const days = dayKeys(now, timeZone, 7);
    const today = days.at(-1)!;
    const yesterday = days.at(-2)!;
    const months = monthKeys(now, timeZone, 12);
    const currentYear = currentMonth.slice(0, 4);

    const transactionBase = {
      workspaceId: request.workspace!.id,
      type: "expense",
      currency,
      status: "completed",
      deletedAt: { $exists: false },
    };

    const [transactionStatsResult, recentTransactions, budgetProgress] = await Promise.all([
      db
        .collection("transactions")
        .aggregate([
          { $match: transactionBase },
          {
            $set: {
              monthKey: {
                $dateToString: { date: "$transactionDate", format: "%Y-%m", timezone: timeZone },
              },
              dayKey: {
                $dateToString: {
                  date: "$transactionDate",
                  format: "%Y-%m-%d",
                  timezone: timeZone,
                },
              },
              yearKey: {
                $dateToString: { date: "$transactionDate", format: "%Y", timezone: timeZone },
              },
            },
          },
          {
            $facet: {
              allTime: [
                {
                  $group: {
                    _id: null,
                    totalMinor: { $sum: "$amountMinor" },
                    transactionCount: { $sum: 1 },
                  },
                },
              ],
              periods: [
                {
                  $group: {
                    _id: null,
                    currentMonthMinor: {
                      $sum: { $cond: [{ $eq: ["$monthKey", currentMonth] }, "$amountMinor", 0] },
                    },
                    previousMonthMinor: {
                      $sum: { $cond: [{ $eq: ["$monthKey", previousMonth] }, "$amountMinor", 0] },
                    },
                    todayMinor: {
                      $sum: { $cond: [{ $eq: ["$dayKey", today] }, "$amountMinor", 0] },
                    },
                    yesterdayMinor: {
                      $sum: { $cond: [{ $eq: ["$dayKey", yesterday] }, "$amountMinor", 0] },
                    },
                  },
                },
              ],
              monthly: [
                { $match: { monthKey: { $in: months } } },
                { $group: { _id: "$monthKey", amountMinor: { $sum: "$amountMinor" } } },
              ],
              weekly: [
                { $match: { dayKey: { $in: days } } },
                { $group: { _id: "$dayKey", amountMinor: { $sum: "$amountMinor" } } },
              ],
              categories: [
                { $match: { yearKey: currentYear } },
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
                    icon: { $ifNull: ["$category.icon", "Wallet"] },
                    totalMinor: 1,
                    transactionCount: 1,
                  },
                },
              ],
            },
          },
        ])
        .next(),
      db
        .collection("transactions")
        .aggregate([
          {
            $match: {
              workspaceId: request.workspace!.id,
              type: "expense",
              currency,
              deletedAt: { $exists: false },
            },
          },
          { $sort: { transactionDate: -1, _id: -1 } },
          { $limit: 6 },
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
              currency: 1,
              transactionDate: 1,
              status: 1,
              category: {
                id: { $toString: "$category._id" },
                name: { $ifNull: ["$category.name", "Archived category"] },
                color: { $ifNull: ["$category.color", "slate"] },
              },
            },
          },
        ])
        .toArray(),
      db
        .collection("budgets")
        .aggregate([
          {
            $match: {
              workspaceId: request.workspace!.id,
              currency,
              status: "active",
              startDate: { $lte: now },
              endDate: { $gte: now },
            },
          },
          {
            $lookup: {
              from: "transactions",
              let: {
                workspace: "$workspaceId",
                category: "$categoryId",
                currency: "$currency",
                start: "$startDate",
                end: "$endDate",
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
                        { $lte: ["$transactionDate", "$$end"] },
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
            $set: {
              spentMinor: { $ifNull: [{ $first: "$spending.amountMinor" }, 0] },
              category: { $first: "$category" },
            },
          },
          { $sort: { spentMinor: -1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              amountMinor: 1,
              spentMinor: 1,
              category: {
                id: { $toString: "$category._id" },
                name: { $ifNull: ["$category.name", "$name"] },
                color: { $ifNull: ["$category.color", "slate"] },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const transactionStats = transactionStatsResult ?? {
      allTime: [],
      periods: [],
      monthly: [],
      weekly: [],
      categories: [],
    };
    const allTime = transactionStats.allTime[0] ?? { totalMinor: 0, transactionCount: 0 };
    const periods = transactionStats.periods[0] ?? {
      currentMonthMinor: 0,
      previousMonthMinor: 0,
      todayMinor: 0,
      yesterdayMinor: 0,
    };
    const monthlyMap = new Map(
      transactionStats.monthly.map((item: { _id: string; amountMinor: number }) => [
        item._id,
        item.amountMinor,
      ]),
    );
    const weeklyMap = new Map(
      transactionStats.weekly.map((item: { _id: string; amountMinor: number }) => [
        item._id,
        item.amountMinor,
      ]),
    );
    const totalBudgetMinor = budgetProgress.reduce((sum, budget) => sum + budget.amountMinor, 0);
    const budgetSpentMinor = budgetProgress.reduce((sum, budget) => sum + budget.spentMinor, 0);

    for (const budget of budgetProgress) {
      const percentage =
        budget.amountMinor > 0 ? (budget.spentMinor / budget.amountMinor) * 100 : 0;
      if (percentage < 80) continue;
      const exceeded = percentage >= 100;
      await db.collection("notifications").updateOne(
        {
          userId: request.auth!.userId,
          workspaceId: request.workspace!.id,
          type: exceeded ? "budget_exceeded" : "budget_warning",
          title: `${budget.name} budget ${currentMonth}`,
        },
        {
          $setOnInsert: {
            userId: request.auth!.userId,
            workspaceId: request.workspace!.id,
            type: exceeded ? "budget_exceeded" : "budget_warning",
            title: `${budget.name} budget ${currentMonth}`,
            message: exceeded
              ? `${budget.name} has exceeded its monthly budget.`
              : `${budget.name} has reached ${Math.round(percentage)}% of its monthly budget.`,
            actionUrl: "/budgets",
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    return {
      currency,
      timeZone,
      summary: {
        totalExpenseMinor: allTime.totalMinor,
        completedTransactionCount: allTime.transactionCount,
        currentMonthMinor: periods.currentMonthMinor,
        previousMonthMinor: periods.previousMonthMinor,
        monthChangePercent: percentageChange(periods.currentMonthMinor, periods.previousMonthMinor),
        todayMinor: periods.todayMinor,
        yesterdayMinor: periods.yesterdayMinor,
        todayChangePercent: percentageChange(periods.todayMinor, periods.yesterdayMinor),
        totalBudgetMinor,
        budgetSpentMinor,
        remainingBudgetMinor: totalBudgetMinor - budgetSpentMinor,
      },
      monthly: months.map((key) => ({ key, amountMinor: monthlyMap.get(key) ?? 0 })),
      weekly: days.map((key) => ({ key, amountMinor: weeklyMap.get(key) ?? 0 })),
      categories: transactionStats.categories,
      recentTransactions,
      budgets: budgetProgress.slice(0, 4),
    };
  });
};
