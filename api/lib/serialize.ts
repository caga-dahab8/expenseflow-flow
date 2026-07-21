import type { ObjectId } from "mongodb";

export function serializeId<T extends { _id: ObjectId }>(document: T) {
  const { _id, ...rest } = document;
  return { id: _id.toHexString(), ...rest };
}
