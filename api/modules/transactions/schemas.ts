import { z } from "zod";

export const transactionStatuses = ["pending", "completed", "failed", "cancelled"] as const;

const editableTransactionSchema = z.object({
  categoryId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  amountMinor: z.number().int().positive().safe(),
  transactionDate: z.string().datetime({ offset: true }),
  merchant: z.string().trim().max(160).optional(),
  reference: z.string().trim().max(160).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const createTransactionSchema = editableTransactionSchema;

export const updateTransactionSchema = editableTransactionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().trim().optional(),
  accountId: z.string().trim().optional(),
  status: z.enum(transactionStatuses).optional(),
  sort: z.enum(["date", "amount"]).default("date"),
});
