import { z } from "zod";

export const accountTypes = [
  "cash",
  "checking",
  "savings",
  "credit_card",
  "mobile_money",
  "other",
] as const;

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(accountTypes),
  institution: z.string().trim().max(120).optional(),
  currency: z.string().trim().length(3).toUpperCase(),
  openingBalanceMinor: z.number().int().safe().default(0),
  lastFourDigits: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional(),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(60).optional(),
  includeInTotals: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateAccountSchema = createAccountSchema
  .omit({ openingBalanceMinor: true })
  .partial()
  .extend({ status: z.enum(["active", "archived"]).optional() })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
