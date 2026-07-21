import { z } from "zod";

export const budgetPeriods = ["weekly", "monthly", "quarterly", "yearly", "custom"] as const;
export const budgetStatuses = ["active", "paused", "archived"] as const;

const budgetFieldsSchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  amountMinor: z.number().int().positive().safe(),
  currency: z.string().trim().length(3).toUpperCase(),
  period: z.enum(budgetPeriods).default("monthly"),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  rollover: z.boolean().default(false),
  alerts: z
    .array(
      z.object({
        percentage: z.number().min(0).max(1000),
        enabled: z.boolean(),
      }),
    )
    .max(10)
    .default([{ percentage: 80, enabled: true }]),
  status: z.enum(budgetStatuses).default("active"),
});

export const createBudgetSchema = budgetFieldsSchema.refine(
  (value) => new Date(value.endDate) >= new Date(value.startDate),
  {
    path: ["endDate"],
    message: "End date must be on or after the start date.",
  },
);

export const updateBudgetSchema = budgetFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const budgetQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  status: z.enum(budgetStatuses).optional(),
});
