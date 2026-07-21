import "dotenv/config";
import { MongoClient } from "mongodb";
import { migrations } from "./migrations/index.js";

const command = process.argv[2] ?? "up";
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE ?? "expenseflow";

if (!uri) {
  console.error(
    "MONGODB_URI is missing. Copy .env.example to .env and add your Atlas connection string.",
  );
  process.exit(1);
}

const client = new MongoClient(uri, { appName: "ExpenseFlow-Migrations" });

async function main() {
  await client.connect();
  const db = client.db(databaseName);
  const history = db.collection<{ migrationId: string; description: string; appliedAt: Date }>(
    "_migrations",
  );
  await history.createIndex({ migrationId: 1 }, { unique: true, name: "migration_id_unique" });

  const applied = new Set(
    (await history.find({}, { projection: { migrationId: 1 } }).toArray()).map(
      (item) => item.migrationId,
    ),
  );

  if (command === "status") {
    for (const migration of migrations) {
      console.log(
        `${applied.has(migration.id) ? "applied" : "pending"}  ${migration.id}  ${migration.description}`,
      );
    }
    return;
  }

  if (command === "up") {
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      console.log(`Applying ${migration.id}...`);
      await migration.up(db);
      await history.insertOne({
        migrationId: migration.id,
        description: migration.description,
        appliedAt: new Date(),
      });
      console.log(`Applied ${migration.id}`);
    }
    return;
  }

  if (command === "down") {
    const migration = [...migrations].reverse().find((item) => applied.has(item.id));
    if (!migration) {
      console.log("No applied migration to roll back.");
      return;
    }
    console.log(`Rolling back ${migration.id}...`);
    await migration.down(db);
    await history.deleteOne({ migrationId: migration.id });
    console.log(`Rolled back ${migration.id}`);
    return;
  }

  throw new Error(`Unknown command: ${command}. Use up, down, or status.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.close());
