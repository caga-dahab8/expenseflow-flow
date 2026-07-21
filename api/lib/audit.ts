import type { Db, ObjectId } from "mongodb";

export async function writeAuditLog(
  db: Db,
  input: {
    workspaceId: ObjectId;
    actorId: ObjectId;
    action: string;
    entityType: string;
    entityId: ObjectId;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  },
) {
  await db.collection("auditLogs").insertOne({ ...input, createdAt: new Date() });
}
