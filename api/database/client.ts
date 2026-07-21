import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";

const client = new MongoClient(env.MONGODB_URI, {
  appName: "ExpenseFlow-API",
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  serverSelectionTimeoutMS: 10_000,
});

let connection: Promise<MongoClient> | undefined;

export function connectToDatabase() {
  connection ??= client.connect().catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export async function getDatabase(): Promise<Db> {
  await connectToDatabase();
  return client.db(env.MONGODB_DATABASE);
}

export async function closeDatabase() {
  if (!connection) return;
  await client.close();
  connection = undefined;
}

export { client as mongoClient };
