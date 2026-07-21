import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(["personal", "family", "business"]),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.enum(["personal", "family", "business"]).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one change.");

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const transferOwnershipSchema = z.object({
  memberId: z.string().trim().min(1),
});
