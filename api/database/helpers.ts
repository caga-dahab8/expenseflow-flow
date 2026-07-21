import type { Db } from "mongodb";
import type { CollectionDefinition } from "./types.js";

export const objectId = { bsonType: "objectId" } as const;
export const date = { bsonType: "date" } as const;
export const nonEmptyString = { bsonType: "string", minLength: 1 } as const;
export const money = { bsonType: ["long", "int", "decimal"], minimum: 0 } as const;

export async function ensureCollection(db: Db, definition: CollectionDefinition) {
  const exists = await db.listCollections({ name: definition.name }, { nameOnly: true }).hasNext();
  const options = {
    validator: definition.validator,
    validationLevel: "strict" as const,
    validationAction: "error" as const,
  };

  if (exists) {
    await db.command({ collMod: definition.name, ...options });
  } else {
    await db.createCollection(definition.name, options);
  }

  if (definition.indexes?.length) {
    await db.collection(definition.name).createIndexes(definition.indexes);
  }
}
