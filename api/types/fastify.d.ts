import type { ObjectId } from "mongodb";

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: ObjectId;
      sessionId: ObjectId;
    } | null;
    workspace: {
      id: ObjectId;
      role: "owner" | "admin" | "member" | "viewer";
    } | null;
  }
}
