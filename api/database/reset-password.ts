import argon2 from "argon2";
import { env } from "../config/env.js";
import { closeDatabase, getDatabase, mongoClient } from "./client.js";

function readHidden(label: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Password reset requires an interactive terminal.");
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (input: string) => {
      for (const character of input) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function resetPassword() {
  if (env.NODE_ENV === "production") {
    throw new Error("The local password reset command is disabled in production.");
  }

  const email = process.argv[2]?.trim().toLocaleLowerCase();
  if (!email) {
    throw new Error("Provide the account email: npm run user:reset-password -- user@example.com");
  }

  let password = "";
  while (!password) {
    const candidate = await readHidden("New password: ");
    if (candidate.length < 10 || candidate.length > 128) {
      console.error("Password must contain between 10 and 128 characters. Try again.");
      continue;
    }
    const confirmation = await readHidden("Confirm password: ");
    if (candidate !== confirmation) {
      console.error("Passwords do not match. Try again.");
      continue;
    }
    password = candidate;
  }

  const db = await getDatabase();
  const user = await db.collection("users").findOne({ emailNormalized: email });
  if (!user) throw new Error(`No ExpenseFlow user exists with email ${email}.`);

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const now = new Date();
  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      await db
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { passwordHash, updatedAt: now } }, { session });
      await db.collection("authSessions").deleteMany({ userId: user._id }, { session });
      await db.collection("auditLogs").insertOne(
        {
          workspaceId:
            (
              await db
                .collection("workspaceMembers")
                .findOne(
                  { userId: user._id, status: "active" },
                  { session, projection: { workspaceId: 1 } },
                )
            )?.workspaceId ?? user._id,
          actorId: user._id,
          action: "user.password_reset_local",
          entityType: "user",
          entityId: user._id,
          changes: { sessionsRevoked: true },
          createdAt: now,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  console.log(`Password reset for ${user.email}. Sign in again with the new password.`);
}

try {
  await resetPassword();
} finally {
  await closeDatabase();
}
