import type { Db, Document, IndexDescription } from "mongodb";

export type CollectionDefinition = {
  name: string;
  validator: Document;
  indexes?: IndexDescription[];
};

export type Migration = {
  id: string;
  description: string;
  up(db: Db): Promise<void>;
  down(db: Db): Promise<void>;
};
