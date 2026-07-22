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

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  currency: z.string().trim().length(3).toUpperCase(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});

export const avatarSchema = z.object({
  dataUrl: z
    .string()
    .max(1_500_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Use a PNG, JPEG, or WebP image."),
});

export const emailSchema = z.object({ email: z.string().trim().email().max(254) });
export const tokenSchema = z.object({ token: z.string().trim().min(32).max(256) });
export const resetPasswordSchema = tokenSchema.extend({
  password: z.string().min(10).max(128),
});

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });
