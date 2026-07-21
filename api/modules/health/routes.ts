import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../../database/client.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  app.get("/health/database", async (_request, reply) => {
    const db = await getDatabase();
    await db.command({ ping: 1 });
    return reply.send({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  });
};
