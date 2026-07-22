import { date, ensureCollection, nonEmptyString, objectId } from "../helpers.js";
import type { Migration } from "../types.js";

export const authTokensMigration: Migration = {
  id: "003_auth_tokens",
  description: "Create one-time account verification and password reset tokens",
  async up(db) {
    await ensureCollection(db, {
      name: "authTokens",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "purpose", "tokenHash", "expiresAt", "createdAt"],
          properties: {
            _id: objectId,
            userId: objectId,
            purpose: { enum: ["verify_email", "reset_password"] },
            tokenHash: nonEmptyString,
            expiresAt: date,
            usedAt: date,
            createdAt: date,
          },
        },
      },
      indexes: [
        { key: { tokenHash: 1 }, name: "auth_tokens_hash_unique", unique: true },
        { key: { userId: 1, purpose: 1 }, name: "auth_tokens_user_purpose" },
        { key: { expiresAt: 1 }, name: "auth_tokens_expiry_ttl", expireAfterSeconds: 0 },
      ],
    });
  },
  async down(db) {
    if (await db.listCollections({ name: "authTokens" }, { nameOnly: true }).hasNext()) {
      await db.collection("authTokens").drop();
    }
  },
};
