import { date, ensureCollection, nonEmptyString, objectId } from "../helpers.js";
import type { Migration } from "../types.js";

export const workspaceInvitationsMigration: Migration = {
  id: "002_workspace_invitations",
  description: "Create workspace invitation storage and indexes",
  async up(db) {
    await ensureCollection(db, {
      name: "workspaceInvitations",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: [
            "workspaceId",
            "email",
            "emailNormalized",
            "role",
            "status",
            "invitedBy",
            "expiresAt",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            _id: objectId,
            workspaceId: objectId,
            email: nonEmptyString,
            emailNormalized: nonEmptyString,
            role: { enum: ["admin", "member", "viewer"] },
            status: { enum: ["pending", "accepted", "revoked", "expired"] },
            invitedBy: objectId,
            acceptedBy: objectId,
            expiresAt: date,
            acceptedAt: date,
            createdAt: date,
            updatedAt: date,
          },
        },
      },
      indexes: [
        {
          key: { workspaceId: 1, emailNormalized: 1 },
          name: "workspace_invitation_unique",
          unique: true,
        },
        { key: { emailNormalized: 1, status: 1 }, name: "invitation_email_status" },
        { key: { workspaceId: 1, status: 1 }, name: "invitation_workspace_status" },
      ],
    });
  },
  async down(db) {
    const exists = await db
      .listCollections({ name: "workspaceInvitations" }, { nameOnly: true })
      .hasNext();
    if (exists) await db.collection("workspaceInvitations").drop();
  },
};
