import type { FastifyReply, FastifyRequest } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase } from "../database/client.js";
import { hashSessionToken, SESSION_COOKIE } from "../lib/auth.js";

type SessionDocument = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
};

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token)
    return reply
      .code(401)
      .send({ error: "UNAUTHENTICATED", message: "Authentication is required." });

  const db = await getDatabase();
  const session = await db.collection<SessionDocument>("authSessions").findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  });

  if (!session)
    return reply
      .code(401)
      .send({ error: "INVALID_SESSION", message: "Your session is invalid or expired." });

  request.auth = { userId: session.userId, sessionId: session._id };
  void db
    .collection("authSessions")
    .updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } });
}
