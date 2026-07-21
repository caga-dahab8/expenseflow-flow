import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["expense", "income"]),
  parentCategoryId: z.string().trim().optional(),
  color: z.string().trim().min(1).max(40).default("slate"),
  icon: z.string().trim().min(1).max(60).default("Wallet"),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ status: z.enum(["active", "archived"]).optional() })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
