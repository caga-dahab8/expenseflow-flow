import type { Document } from "mongodb";
import { date, ensureCollection, money, nonEmptyString, objectId } from "../helpers.js";
import type { CollectionDefinition, Migration } from "../types.js";

const timestamps = {
  createdAt: date,
  updatedAt: date,
};

function schema(required: string[], properties: Document): Document {
  return {
    $jsonSchema: {
      bsonType: "object",
      required,
      properties: { _id: objectId, ...properties },
    },
  };
}

const collections: CollectionDefinition[] = [
  {
    name: "users",
    validator: schema(["name", "email", "emailNormalized", "status", "createdAt", "updatedAt"], {
      name: nonEmptyString,
      email: nonEmptyString,
      emailNormalized: nonEmptyString,
      passwordHash: { bsonType: "string" },
      avatarUrl: { bsonType: "string" },
      phone: { bsonType: "string" },
      preferences: {
        bsonType: "object",
        properties: {
          currency: { bsonType: "string", minLength: 3, maxLength: 3 },
          language: { bsonType: "string" },
          timezone: { bsonType: "string" },
          dateFormat: { bsonType: "string" },
          theme: { enum: ["light", "dark", "system"] },
        },
      },
      emailVerifiedAt: date,
      lastLoginAt: date,
      status: { enum: ["active", "suspended", "deletion_pending"] },
      ...timestamps,
    }),
    indexes: [
      { key: { emailNormalized: 1 }, name: "users_email_unique", unique: true },
      { key: { status: 1 }, name: "users_status" },
    ],
  },
  {
    name: "authSessions",
    validator: schema(["userId", "tokenHash", "expiresAt", "lastUsedAt", "createdAt"], {
      userId: objectId,
      tokenHash: nonEmptyString,
      ipAddress: { bsonType: "string" },
      userAgent: { bsonType: "string" },
      expiresAt: date,
      lastUsedAt: date,
      createdAt: date,
    }),
    indexes: [
      { key: { tokenHash: 1 }, name: "sessions_token_unique", unique: true },
      { key: { userId: 1 }, name: "sessions_user" },
      { key: { expiresAt: 1 }, name: "sessions_expiry_ttl", expireAfterSeconds: 0 },
    ],
  },
  {
    name: "workspaces",
    validator: schema(["name", "type", "ownerId", "status", "createdAt", "updatedAt"], {
      name: nonEmptyString,
      type: { enum: ["personal", "family", "business"] },
      ownerId: objectId,
      settings: {
        bsonType: "object",
        properties: {
          defaultCurrency: { bsonType: "string", minLength: 3, maxLength: 3 },
          timezone: { bsonType: "string" },
          fiscalYearStartMonth: { bsonType: "int", minimum: 1, maximum: 12 },
        },
      },
      status: { enum: ["active", "archived"] },
      ...timestamps,
    }),
    indexes: [{ key: { ownerId: 1 }, name: "workspaces_owner" }],
  },
  {
    name: "workspaceMembers",
    validator: schema(["workspaceId", "userId", "role", "status", "createdAt", "updatedAt"], {
      workspaceId: objectId,
      userId: objectId,
      role: { enum: ["owner", "admin", "member", "viewer"] },
      status: { enum: ["active", "invited", "removed"] },
      invitedBy: objectId,
      joinedAt: date,
      ...timestamps,
    }),
    indexes: [
      { key: { workspaceId: 1, userId: 1 }, name: "members_workspace_user_unique", unique: true },
      { key: { userId: 1, status: 1 }, name: "members_user_status" },
    ],
  },
  {
    name: "accounts",
    validator: schema(
      [
        "workspaceId",
        "name",
        "type",
        "currency",
        "openingBalanceMinor",
        "status",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      {
        workspaceId: objectId,
        name: nonEmptyString,
        type: { enum: ["cash", "checking", "savings", "credit_card", "mobile_money", "other"] },
        institution: { bsonType: "string" },
        currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        openingBalanceMinor: { bsonType: ["long", "int", "decimal"] },
        currentBalanceMinor: { bsonType: ["long", "int", "decimal"] },
        lastFourDigits: { bsonType: "string", maxLength: 4 },
        color: { bsonType: "string" },
        icon: { bsonType: "string" },
        includeInTotals: { bsonType: "bool" },
        isDefault: { bsonType: "bool" },
        status: { enum: ["active", "archived"] },
        createdBy: objectId,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, status: 1 }, name: "accounts_workspace_status" },
      { key: { workspaceId: 1, isDefault: 1 }, name: "accounts_workspace_default" },
    ],
  },
  {
    name: "categories",
    validator: schema(
      [
        "workspaceId",
        "name",
        "normalizedName",
        "type",
        "status",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      {
        workspaceId: objectId,
        name: nonEmptyString,
        normalizedName: nonEmptyString,
        type: { enum: ["expense", "income"] },
        parentCategoryId: objectId,
        color: { bsonType: "string" },
        icon: { bsonType: "string" },
        isSystem: { bsonType: "bool" },
        status: { enum: ["active", "archived"] },
        createdBy: objectId,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, type: 1, status: 1 }, name: "categories_workspace_type_status" },
      {
        key: { workspaceId: 1, normalizedName: 1, type: 1 },
        name: "categories_name_unique",
        unique: true,
      },
      { key: { parentCategoryId: 1 }, name: "categories_parent" },
    ],
  },
  {
    name: "transactions",
    validator: schema(
      [
        "workspaceId",
        "accountId",
        "type",
        "title",
        "amountMinor",
        "currency",
        "transactionDate",
        "paymentMethod",
        "status",
        "source",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      {
        workspaceId: objectId,
        accountId: objectId,
        categoryId: objectId,
        type: { enum: ["expense", "income", "transfer", "refund"] },
        title: nonEmptyString,
        description: { bsonType: "string" },
        amountMinor: money,
        currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        exchangeRate: { bsonType: "string" },
        baseAmountMinor: money,
        transactionDate: date,
        paymentMethod: {
          enum: [
            "cash",
            "credit_card",
            "debit_card",
            "bank_transfer",
            "mobile_money",
            "paypal",
            "other",
          ],
        },
        status: { enum: ["pending", "completed", "failed", "cancelled"] },
        merchant: { bsonType: "string" },
        reference: { bsonType: "string" },
        tags: { bsonType: "array", uniqueItems: true, items: { bsonType: "string" } },
        transferAccountId: objectId,
        recurringTransactionId: objectId,
        source: { enum: ["manual", "import", "recurring", "bank_sync"] },
        importBatchId: objectId,
        externalId: { bsonType: "string" },
        createdBy: objectId,
        updatedBy: objectId,
        deletedAt: date,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, transactionDate: -1 }, name: "transactions_workspace_date" },
      { key: { workspaceId: 1, type: 1, transactionDate: -1 }, name: "transactions_type_date" },
      {
        key: { workspaceId: 1, categoryId: 1, transactionDate: -1 },
        name: "transactions_category_date",
      },
      {
        key: { workspaceId: 1, accountId: 1, transactionDate: -1 },
        name: "transactions_account_date",
      },
      { key: { workspaceId: 1, status: 1, transactionDate: -1 }, name: "transactions_status_date" },
      {
        key: { workspaceId: 1, externalId: 1 },
        name: "transactions_external_unique",
        unique: true,
        partialFilterExpression: { externalId: { $type: "string" } },
      },
      { key: { title: "text", merchant: "text" }, name: "transactions_text_search" },
    ],
  },
  {
    name: "budgets",
    validator: schema(
      [
        "workspaceId",
        "name",
        "amountMinor",
        "currency",
        "period",
        "startDate",
        "status",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      {
        workspaceId: objectId,
        categoryId: objectId,
        name: nonEmptyString,
        amountMinor: money,
        currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        period: { enum: ["weekly", "monthly", "quarterly", "yearly", "custom"] },
        startDate: date,
        endDate: date,
        rollover: { bsonType: "bool" },
        alerts: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["percentage", "enabled"],
            properties: {
              percentage: { bsonType: ["int", "double", "decimal"], minimum: 0 },
              enabled: { bsonType: "bool" },
            },
          },
        },
        status: { enum: ["active", "paused", "archived"] },
        createdBy: objectId,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, status: 1, startDate: 1 }, name: "budgets_workspace_status_start" },
      { key: { workspaceId: 1, categoryId: 1, startDate: 1 }, name: "budgets_category_start" },
    ],
  },
  {
    name: "recurringTransactions",
    validator: schema(
      [
        "workspaceId",
        "accountId",
        "type",
        "title",
        "amountMinor",
        "currency",
        "frequency",
        "interval",
        "startDate",
        "nextRunAt",
        "status",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      {
        workspaceId: objectId,
        accountId: objectId,
        categoryId: objectId,
        type: { enum: ["expense", "income"] },
        title: nonEmptyString,
        description: { bsonType: "string" },
        amountMinor: money,
        currency: { bsonType: "string", minLength: 3, maxLength: 3 },
        paymentMethod: { bsonType: "string" },
        frequency: { enum: ["daily", "weekly", "monthly", "quarterly", "yearly"] },
        interval: { bsonType: "int", minimum: 1 },
        startDate: date,
        endDate: date,
        nextRunAt: date,
        lastRunAt: date,
        autoCreate: { bsonType: "bool" },
        status: { enum: ["active", "paused", "completed"] },
        createdBy: objectId,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { status: 1, nextRunAt: 1 }, name: "recurring_due" },
      { key: { workspaceId: 1, status: 1 }, name: "recurring_workspace_status" },
    ],
  },
  {
    name: "attachments",
    validator: schema(
      [
        "workspaceId",
        "transactionId",
        "fileName",
        "storageKey",
        "mimeType",
        "sizeBytes",
        "uploadedBy",
        "createdAt",
      ],
      {
        workspaceId: objectId,
        transactionId: objectId,
        fileName: nonEmptyString,
        storageKey: nonEmptyString,
        mimeType: nonEmptyString,
        sizeBytes: { bsonType: ["long", "int"], minimum: 0 },
        checksum: { bsonType: "string" },
        uploadedBy: objectId,
        createdAt: date,
      },
    ),
    indexes: [
      { key: { transactionId: 1 }, name: "attachments_transaction" },
      { key: { workspaceId: 1, createdAt: -1 }, name: "attachments_workspace_created" },
      { key: { storageKey: 1 }, name: "attachments_storage_unique", unique: true },
    ],
  },
  {
    name: "notifications",
    validator: schema(["userId", "type", "title", "message", "createdAt"], {
      userId: objectId,
      workspaceId: objectId,
      type: {
        enum: [
          "budget_warning",
          "budget_exceeded",
          "transaction_created",
          "report_ready",
          "system",
        ],
      },
      title: nonEmptyString,
      message: nonEmptyString,
      actionUrl: { bsonType: "string" },
      readAt: date,
      createdAt: date,
      expiresAt: date,
    }),
    indexes: [
      { key: { userId: 1, readAt: 1, createdAt: -1 }, name: "notifications_user_unread" },
      {
        key: { expiresAt: 1 },
        name: "notifications_expiry_ttl",
        expireAfterSeconds: 0,
        sparse: true,
      },
    ],
  },
  {
    name: "importBatches",
    validator: schema(
      [
        "workspaceId",
        "fileName",
        "source",
        "status",
        "totalRows",
        "importedRows",
        "skippedRows",
        "failedRows",
        "createdBy",
        "createdAt",
      ],
      {
        workspaceId: objectId,
        accountId: objectId,
        fileName: nonEmptyString,
        source: { enum: ["csv", "bank_statement", "bank_api"] },
        status: { enum: ["pending", "processing", "completed", "failed"] },
        totalRows: { bsonType: "int", minimum: 0 },
        importedRows: { bsonType: "int", minimum: 0 },
        skippedRows: { bsonType: "int", minimum: 0 },
        failedRows: { bsonType: "int", minimum: 0 },
        errors: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["message"],
            properties: { row: { bsonType: "int", minimum: 1 }, message: nonEmptyString },
          },
        },
        createdBy: objectId,
        completedAt: date,
        createdAt: date,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, createdAt: -1 }, name: "imports_workspace_created" },
      { key: { status: 1, createdAt: 1 }, name: "imports_status_created" },
    ],
  },
  {
    name: "auditLogs",
    validator: schema(["workspaceId", "actorId", "action", "entityType", "entityId", "createdAt"], {
      workspaceId: objectId,
      actorId: objectId,
      action: nonEmptyString,
      entityType: nonEmptyString,
      entityId: objectId,
      changes: { bsonType: "object" },
      ipAddress: { bsonType: "string" },
      userAgent: { bsonType: "string" },
      createdAt: date,
    }),
    indexes: [
      { key: { workspaceId: 1, createdAt: -1 }, name: "audit_workspace_created" },
      { key: { workspaceId: 1, entityType: 1, entityId: 1 }, name: "audit_entity" },
      { key: { actorId: 1, createdAt: -1 }, name: "audit_actor_created" },
    ],
  },
  {
    name: "savedReports",
    validator: schema(
      ["workspaceId", "name", "reportType", "filters", "createdBy", "createdAt", "updatedAt"],
      {
        workspaceId: objectId,
        name: nonEmptyString,
        reportType: { enum: ["spending", "income_expense", "category", "budget"] },
        filters: { bsonType: "object" },
        schedule: {
          bsonType: "object",
          properties: {
            enabled: { bsonType: "bool" },
            frequency: { enum: ["weekly", "monthly", "quarterly"] },
            recipients: { bsonType: "array", items: { bsonType: "string" } },
          },
        },
        createdBy: objectId,
        ...timestamps,
      },
    ),
    indexes: [
      { key: { workspaceId: 1, createdAt: -1 }, name: "reports_workspace_created" },
      { key: { workspaceId: 1, reportType: 1 }, name: "reports_workspace_type" },
    ],
  },
];

export const initialSchemaMigration: Migration = {
  id: "001_initial_schema",
  description: "Create ExpenseFlow collections, validators, and indexes",
  async up(db) {
    for (const definition of collections) {
      await ensureCollection(db, definition);
    }
  },
  async down(db) {
    for (const definition of [...collections].reverse()) {
      const exists = await db
        .listCollections({ name: definition.name }, { nameOnly: true })
        .hasNext();
      if (exists) await db.collection(definition.name).drop();
    }
  },
};
