import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase, connectToDatabase } from "./database/client.js";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down API");
  await app.close();
  await closeDatabase();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await connectToDatabase();
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  await closeDatabase();
  process.exit(1);
}
