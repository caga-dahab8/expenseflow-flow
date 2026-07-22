import { z } from "zod";

export const recurringInputSchema = z.object({
  categoryId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  amountMinor: z.number().int().positive().safe(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  interval: z.number().int().min(1).max(100).default(1),
  startDate: z.string().datetime({ offset: true }),
  autoCreate: z.boolean().default(true),
});

export const importSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  rows: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        amount: z.coerce.number().positive(),
        date: z.string().trim().min(1),
        category: z.string().trim().max(100).optional(),
        description: z.string().trim().max(2000).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

export const attachmentSchema = z.object({
  transactionId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(2_000_000),
  dataUrl: z
    .string()
    .max(2_800_000)
    .regex(/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/),
});

export const savedReportSchema = z.object({
  name: z.string().trim().min(2).max(100),
  reportType: z.enum(["spending", "income_expense", "category", "budget"]),
  filters: z.object({ start: z.string(), end: z.string() }).passthrough(),
});

export const searchSchema = z.object({ q: z.string().trim().min(2).max(100) });
