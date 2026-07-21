import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});
