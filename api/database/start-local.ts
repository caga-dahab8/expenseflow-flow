import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";
import { env } from "../config/env.js";

const uri = new URL(env.MONGODB_URI);
const host = uri.hostname;
const port = Number(uri.port || 27017);
const isLocal = host === "127.0.0.1" || host === "localhost";

function canConnect() {
  return new Promise<boolean>((resolveConnection) => {
    const socket = net.createConnection({ host, port });
    const finish = (connected: boolean) => {
      socket.destroy();
      resolveConnection(connected);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await canConnect()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Local MongoDB did not begin listening on ${host}:${port}.`);
}

async function ensureReplicaSet() {
  const directUri = `mongodb://${host}:${port}/?directConnection=true&retryWrites=false`;
  const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 5_000 });
  await client.connect();
  try {
    try {
      await client.db("admin").command({ replSetGetStatus: 1 });
    } catch (error) {
      const mongoError = error as { codeName?: string; code?: number };
      if (mongoError.codeName !== "NotYetInitialized" && mongoError.code !== 94) throw error;
      await client.db("admin").command({
        replSetInitiate: {
          _id: "rs0",
          members: [{ _id: 0, host: `${host}:${port}` }],
        },
      });
    }
  } finally {
    await client.close();
  }

  const replicaClient = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
  await replicaClient.connect();
  try {
    const hello = await replicaClient.db("admin").command({ hello: 1 });
    if (!hello.isWritablePrimary) throw new Error("The local replica set has no writable primary.");
  } finally {
    await replicaClient.close();
  }
}

if (!isLocal || port !== 27018) {
  console.log("MONGODB_URI is not the ExpenseFlow local development server; startup skipped.");
} else {
  if (!(await canConnect())) {
    const projectRoot = resolve(import.meta.dirname, "../..");
    const dataPath = resolve(projectRoot, ".mongodb/data");
    const logPath = resolve(projectRoot, ".mongodb/mongod.log");
    const executable =
      process.env.MONGOD_PATH ?? "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe";
    if (!existsSync(executable)) {
      throw new Error(
        `MongoDB executable was not found at ${executable}. Install MongoDB 8.0 or set MONGOD_PATH to your mongod executable.`,
      );
    }
    mkdirSync(dataPath, { recursive: true });
    const child = spawn(
      executable,
      [
        "--dbpath",
        dataPath,
        "--logpath",
        logPath,
        "--logappend",
        "--port",
        String(port),
        "--bind_ip",
        host,
        "--replSet",
        "rs0",
      ],
      {
        detached: true,
        windowsHide: true,
        stdio: "ignore",
      },
    );
    child.unref();
    await waitForPort();
    console.log(`Started local MongoDB on ${host}:${port}.`);
  } else {
    console.log(`Local MongoDB is already running on ${host}:${port}.`);
  }
  await ensureReplicaSet();
  console.log("Local MongoDB replica set rs0 is ready.");
}
