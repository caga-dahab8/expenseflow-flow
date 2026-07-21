import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/routes.js";
import { accountRoutes } from "./modules/accounts/routes.js";
import { categoryRoutes } from "./modules/categories/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { workspaceRoutes } from "./modules/workspaces/routes.js";
import { transactionRoutes } from "./modules/transactions/routes.js";
import { budgetRoutes } from "./modules/budgets/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: true,
  });
  app.decorateRequest("auth", null);
  app.decorateRequest("workspace", null);

  await app.register(helmet);
  await app.register(cors, {
    // Vite can expose development builds over localhost or a LAN/sandbox IP.
    // Reflect the requesting origin only in development; production remains locked down.
    origin: env.NODE_ENV === "development" ? true : env.APP_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.register(accountRoutes, { prefix: "/api" });
  await app.register(categoryRoutes, { prefix: "/api" });
  await app.register(transactionRoutes, { prefix: "/api" });
  await app.register(budgetRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });
  await app.register(reportRoutes, { prefix: "/api" });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "NOT_FOUND", message: "The requested endpoint does not exist." });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "The request contains invalid data.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if ((error as { code?: number }).code === 11000) {
      return reply
        .code(409)
        .send({ error: "CONFLICT", message: "A record with these details already exists." });
    }

    request.log.error(error);
    return reply
      .code(500)
      .send({ error: "INTERNAL_ERROR", message: "An unexpected error occurred." });
  });

  return app;
}
