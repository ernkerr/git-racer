import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

let _db: NodePgDatabase<typeof schema> | null = null;

/** Get or create the Drizzle ORM instance (singleton). */
export function getDb() {
  if (!_db) {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

/**
 * Lazy-initialized database proxy.
 * Defers connection creation until first query, so importing this module
 * doesn't immediately connect to Postgres (useful for tests and cold starts).
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
