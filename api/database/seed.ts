import { ObjectId } from "mongodb";
import { env } from "../config/env.js";
import { closeDatabase, getDatabase, mongoClient } from "./client.js";

const SEED_VERSION = "expenseflow-demo-v1";

type WorkspaceDocument = {
  _id: ObjectId;
  name: string;
  ownerId: ObjectId;
  settings?: { defaultCurrency?: string };
  status: string;
  createdAt: Date;
};

type CategoryDocument = {
  _id: ObjectId;
  name: string;
  normalizedName: string;
  status: string;
};

const expenseTemplates = [
  {
    category: "food & dining",
    title: "Lunch and groceries",
    merchant: "Neighborhood Market",
    base: 4200,
    paymentMethod: "debit_card",
  },
  {
    category: "transport",
    title: "Transport fare",
    merchant: "City Transport",
    base: 1850,
    paymentMethod: "mobile_money",
  },
  {
    category: "shopping",
    title: "Household shopping",
    merchant: "Retail Store",
    base: 6800,
    paymentMethod: "credit_card",
  },
  {
    category: "bills & utilities",
    title: "Monthly utility bill",
    merchant: "Utility Provider",
    base: 9100,
    paymentMethod: "bank_transfer",
  },
  {
    category: "healthcare",
    title: "Pharmacy purchase",
    merchant: "Community Pharmacy",
    base: 3600,
    paymentMethod: "debit_card",
  },
  {
    category: "education",
    title: "Learning materials",
    merchant: "Book Store",
    base: 5400,
    paymentMethod: "credit_card",
  },
  {
    category: "entertainment",
    title: "Weekend entertainment",
    merchant: "Entertainment Center",
    base: 2900,
    paymentMethod: "cash",
  },
  {
    category: "other",
    title: "Miscellaneous expense",
    merchant: "Local Vendor",
    base: 2100,
    paymentMethod: "cash",
  },
] as const;

const budgetLimits: Record<string, number> = {
  "food & dining": 45_000,
  transport: 25_000,
  shopping: 35_000,
  "bills & utilities": 40_000,
  healthcare: 20_000,
  education: 30_000,
  entertainment: 18_000,
  other: 12_000,
};

function parseWorkspaceId() {
  const value = process.argv[2];
  if (!value) return undefined;
  if (!ObjectId.isValid(value)) throw new Error("The workspace ID argument is invalid.");
  return new ObjectId(value);
}

function dateInMonth(monthOffset: number, itemIndex: number) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 2 + itemIndex * 3, 12),
  );
}

async function seed() {
  if (env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }

  const db = await getDatabase();
  const requestedWorkspaceId = parseWorkspaceId();
  const workspace = await db
    .collection<WorkspaceDocument>("workspaces")
    .findOne(
      { ...(requestedWorkspaceId ? { _id: requestedWorkspaceId } : {}), status: "active" },
      { sort: { createdAt: -1 } },
    );
  if (!workspace) {
    throw new Error("No active workspace found. Register an ExpenseFlow user first.");
  }

  const existingSeed = await db.collection("transactions").findOne({
    workspaceId: workspace._id,
    externalId: `${SEED_VERSION}-000`,
  });

  const [account, categories] = await Promise.all([
    db.collection("accounts").findOne({
      workspaceId: workspace._id,
      status: "active",
      isDefault: true,
    }),
    db
      .collection<CategoryDocument>("categories")
      .find({ workspaceId: workspace._id, type: "expense", status: "active" })
      .toArray(),
  ]);
  if (!account) throw new Error("The workspace does not have an active default account.");

  const categoriesByName = new Map(
    categories.map((category) => [category.normalizedName, category]),
  );
  const missing = expenseTemplates.filter((item) => !categoriesByName.has(item.category));
  if (missing.length) {
    throw new Error(
      `Missing default categories: ${missing.map((item) => item.category).join(", ")}`,
    );
  }

  const currency = workspace.settings?.defaultCurrency ?? account.currency ?? "USD";
  const now = new Date();
  const transactions = existingSeed
    ? []
    : Array.from({ length: 12 }, (_, monthOffset) =>
        Array.from({ length: 6 }, (_, itemIndex) => {
          const templateIndex = (monthOffset * 3 + itemIndex) % expenseTemplates.length;
          const template = expenseTemplates[templateIndex];
          const category = categoriesByName.get(template.category)!;
          const sequence = monthOffset * 6 + itemIndex;
          const variation = ((monthOffset + 2) * (itemIndex + 3) * 137) % 2600;
          return {
            _id: new ObjectId(),
            workspaceId: workspace._id,
            accountId: account._id,
            categoryId: category._id,
            type: "expense",
            title: template.title,
            description: "Development demo data",
            amountMinor: template.base + variation,
            currency,
            transactionDate: dateInMonth(monthOffset, itemIndex),
            paymentMethod: template.paymentMethod,
            status: "completed",
            merchant: template.merchant,
            reference: `DEMO-${String(sequence + 1).padStart(3, "0")}`,
            tags: ["demo"],
            source: "import",
            externalId: `${SEED_VERSION}-${String(sequence).padStart(3, "0")}`,
            createdBy: workspace.ownerId,
            createdAt: now,
            updatedAt: now,
          };
        }),
      ).flat();

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  const budgets = categories
    .filter((category) => budgetLimits[category.normalizedName])
    .map((category) => ({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      categoryId: category._id,
      name: category.name,
      amountMinor: budgetLimits[category.normalizedName],
      currency,
      period: "monthly",
      startDate: monthStart,
      endDate: monthEnd,
      rollover: false,
      alerts: [{ percentage: 80, enabled: true }],
      status: "active",
      createdBy: workspace.ownerId,
      createdAt: now,
      updatedAt: now,
    }));

  const existingBudgetCategories = new Set(
    (
      await db
        .collection("budgets")
        .find({
          workspaceId: workspace._id,
          categoryId: { $in: budgets.map((budget) => budget.categoryId) },
          startDate: monthStart,
          endDate: monthEnd,
          status: { $ne: "archived" },
        })
        .project({ categoryId: 1 })
        .toArray()
    ).map((budget) => budget.categoryId.toHexString()),
  );
  const newBudgets = budgets.filter(
    (budget) => !existingBudgetCategories.has(budget.categoryId.toHexString()),
  );
  const totalExpenseMinor = transactions.reduce(
    (sum, transaction) => sum + transaction.amountMinor,
    0,
  );
  const session = mongoClient.startSession();
  const foodCategory = categoriesByName.get("food & dining")!;
  const recurringExists = await db.collection("recurringTransactions").findOne({
    workspaceId: workspace._id,
    title: "Monthly groceries",
  });
  const savedReportExists = await db.collection("savedReports").findOne({
    workspaceId: workspace._id,
    name: "Current year spending",
  });
  try {
    await session.withTransaction(async () => {
      if (transactions.length)
        await db.collection("transactions").insertMany(transactions, { session });
      if (newBudgets.length) await db.collection("budgets").insertMany(newBudgets, { session });
      if (!recurringExists)
        await db.collection("recurringTransactions").insertOne(
          {
            workspaceId: workspace._id,
            accountId: account._id,
            categoryId: foodCategory._id,
            type: "expense",
            title: "Monthly groceries",
            description: "Example recurring expense",
            amountMinor: 20000,
            currency,
            frequency: "monthly",
            interval: 1,
            startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12)),
            nextRunAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12)),
            autoCreate: true,
            status: "active",
            createdBy: workspace.ownerId,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      if (!savedReportExists)
        await db.collection("savedReports").insertOne(
          {
            workspaceId: workspace._id,
            name: "Current year spending",
            reportType: "spending",
            filters: {
              start: `${now.getUTCFullYear()}-01-01`,
              end: now.toISOString().slice(0, 10),
            },
            createdBy: workspace.ownerId,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      await db.collection("notifications").updateOne(
        { userId: workspace.ownerId, workspaceId: workspace._id, title: "Automation is ready" },
        {
          $setOnInsert: {
            userId: workspace.ownerId,
            workspaceId: workspace._id,
            type: "system",
            title: "Automation is ready",
            message:
              "Recurring expenses, CSV import, saved reports, and activity history are available.",
            actionUrl: "/automation",
            createdAt: now,
          },
        },
        { upsert: true, session },
      );
      await db
        .collection("accounts")
        .updateOne(
          { _id: account._id, workspaceId: workspace._id },
          { $inc: { currentBalanceMinor: -totalExpenseMinor }, $set: { updatedAt: now } },
          { session },
        );
      await db.collection("auditLogs").insertOne(
        {
          workspaceId: workspace._id,
          actorId: workspace.ownerId,
          action: "database.demo_seeded",
          entityType: "workspace",
          entityId: workspace._id,
          changes: {
            version: SEED_VERSION,
            transactions: transactions.length,
            budgets: newBudgets.length,
          },
          createdAt: now,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  console.log(
    `Seed complete for ${workspace.name}: ${transactions.length} new expenses, ${newBudgets.length} budgets, and automation examples.`,
  );
}

try {
  await seed();
} finally {
  await closeDatabase();
}
