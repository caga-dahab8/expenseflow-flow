import type { FastifyPluginAsync } from "fastify";
import { ObjectId } from "mongodb";
import { getDatabase } from "../../database/client.js";
import { writeAuditLog } from "../../lib/audit.js";
import { serializeId } from "../../lib/serialize.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeWorkspace, requireWorkspaceRole } from "../../middleware/authorize-workspace.js";
import { createCategorySchema, updateCategorySchema } from "./schemas.js";

type CategoryDocument = {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  normalizedName: string;
  type: "expense" | "income";
  parentCategoryId?: ObjectId;
  color: string;
  icon: string;
  isSystem: boolean;
  status: "active" | "archived";
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const baseHandlers = [authenticate, authorizeWorkspace];
const writeHandlers = [...baseHandlers, requireWorkspaceRole("owner", "admin", "member")];

function parseParentId(value?: string) {
  if (!value) return undefined;
  if (!ObjectId.isValid(value)) throw new Error("INVALID_PARENT_CATEGORY");
  return new ObjectId(value);
}

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", { preHandler: baseHandlers }, async (request) => {
    const db = await getDatabase();
    const categories = await db
      .collection<CategoryDocument>("categories")
      .aggregate([
        { $match: { workspaceId: request.workspace!.id } },
        {
          $lookup: {
            from: "transactions",
            let: { workspace: "$workspaceId", category: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$workspaceId", "$$workspace"] },
                      { $eq: ["$categoryId", "$$category"] },
                      { $eq: ["$status", "completed"] },
                      { $eq: [{ $type: "$deletedAt" }, "missing"] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$currency",
                  totalMinor: { $sum: "$amountMinor" },
                  transactionCount: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  currency: "$_id",
                  totalMinor: 1,
                  transactionCount: 1,
                },
              },
            ],
            as: "totals",
          },
        },
        { $sort: { status: 1, type: 1, name: 1 } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            name: 1,
            type: 1,
            color: 1,
            icon: 1,
            isSystem: 1,
            status: 1,
            totals: 1,
          },
        },
      ])
      .toArray();
    return { categories };
  });

  app.post("/categories", { preHandler: writeHandlers }, async (request, reply) => {
    const input = createCategorySchema.parse(request.body);
    let parentCategoryId: ObjectId | undefined;
    try {
      parentCategoryId = parseParentId(input.parentCategoryId);
    } catch {
      return reply
        .code(400)
        .send({ error: "INVALID_PARENT_CATEGORY", message: "The parent category is invalid." });
    }
    const db = await getDatabase();
    if (parentCategoryId) {
      const parent = await db
        .collection("categories")
        .findOne({ _id: parentCategoryId, workspaceId: request.workspace!.id });
      if (!parent)
        return reply.code(400).send({
          error: "INVALID_PARENT_CATEGORY",
          message: "The parent category does not exist.",
        });
    }

    const now = new Date();
    const id = new ObjectId();
    const { parentCategoryId: _ignored, ...fields } = input;
    const category: CategoryDocument = {
      _id: id,
      workspaceId: request.workspace!.id,
      ...fields,
      normalizedName: input.name.toLocaleLowerCase(),
      ...(parentCategoryId ? { parentCategoryId } : {}),
      isSystem: false,
      status: "active",
      createdBy: request.auth!.userId,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<CategoryDocument>("categories").insertOne(category);
    await writeAuditLog(db, {
      workspaceId: request.workspace!.id,
      actorId: request.auth!.userId,
      action: "category.created",
      entityType: "category",
      entityId: id,
      changes: { name: input.name, type: input.type },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.code(201).send({ category: serializeId(category) });
  });

  app.patch<{ Params: { id: string } }>(
    "/categories/:id",
    { preHandler: writeHandlers },
    async (request, reply) => {
      if (!ObjectId.isValid(request.params.id)) {
        return reply
          .code(400)
          .send({ error: "INVALID_CATEGORY", message: "The category identifier is invalid." });
      }
      const input = updateCategorySchema.parse(request.body);
      let parentCategoryId: ObjectId | undefined;
      try {
        parentCategoryId = parseParentId(input.parentCategoryId);
      } catch {
        return reply
          .code(400)
          .send({ error: "INVALID_PARENT_CATEGORY", message: "The parent category is invalid." });
      }
      const db = await getDatabase();
      const id = new ObjectId(request.params.id);
      if (parentCategoryId?.equals(id)) {
        return reply.code(400).send({
          error: "INVALID_PARENT_CATEGORY",
          message: "A category cannot be its own parent.",
        });
      }
      if (parentCategoryId) {
        const parent = await db
          .collection("categories")
          .findOne({ _id: parentCategoryId, workspaceId: request.workspace!.id });
        if (!parent)
          return reply.code(400).send({
            error: "INVALID_PARENT_CATEGORY",
            message: "The parent category does not exist.",
          });
      }

      const { parentCategoryId: _ignored, ...fields } = input;
      const changes = {
        ...fields,
        ...(input.name ? { normalizedName: input.name.toLocaleLowerCase() } : {}),
        ...(parentCategoryId ? { parentCategoryId } : {}),
        updatedAt: new Date(),
      };
      const category = await db
        .collection<CategoryDocument>("categories")
        .findOneAndUpdate(
          { _id: id, workspaceId: request.workspace!.id },
          { $set: changes },
          { returnDocument: "after" },
        );
      if (!category)
        return reply
          .code(404)
          .send({ error: "CATEGORY_NOT_FOUND", message: "Category not found." });

      await writeAuditLog(db, {
        workspaceId: request.workspace!.id,
        actorId: request.auth!.userId,
        action: input.status === "archived" ? "category.archived" : "category.updated",
        entityType: "category",
        entityId: id,
        changes: input,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      return { category: serializeId(category) };
    },
  );
};
