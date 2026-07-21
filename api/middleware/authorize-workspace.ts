import type { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase } from "../database/client.js";

type Membership = {
  workspaceId: ObjectId;
  userId: ObjectId;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "invited" | "removed";
};

export async function authorizeWorkspace(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return;

  const requestedId = request.headers["x-workspace-id"];
  if (Array.isArray(requestedId)) {
    return reply
      .code(400)
      .send({ error: "INVALID_WORKSPACE", message: "Provide one workspace identifier." });
  }
  if (requestedId && !ObjectId.isValid(requestedId)) {
    return reply
      .code(400)
      .send({ error: "INVALID_WORKSPACE", message: "The workspace identifier is invalid." });
  }

  const db = await getDatabase();
  const membership = await db.collection<Membership>("workspaceMembers").findOne({
    userId: request.auth.userId,
    status: "active",
    ...(requestedId ? { workspaceId: new ObjectId(requestedId) } : {}),
  });

  if (!membership) {
    return reply
      .code(403)
      .send({ error: "WORKSPACE_FORBIDDEN", message: "You do not have access to this workspace." });
  }

  request.workspace = { id: membership.workspaceId, role: membership.role };
}

export function requireWorkspaceRole(...allowed: Membership["role"][]) {
  return async function checkWorkspaceRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.workspace || !allowed.includes(request.workspace.role)) {
      return reply.code(403).send({
        error: "INSUFFICIENT_ROLE",
        message: "Your workspace role cannot perform this action.",
      });
    }
  };
}
