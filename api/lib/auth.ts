import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "expenseflow_session";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(`${env.SESSION_SECRET}:${token}`).digest("hex");
}

export function sessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + env.SESSION_TTL_DAYS);
  return expiresAt;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}
