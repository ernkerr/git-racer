import { getDb } from "../db/index.js";
import type pg from "pg";

/**
 * Stable lock IDs for each cron job.
 * Using a high base (737xxx) to avoid collision with any row IDs.
 * Each job MUST have a unique ID — add new jobs here before using them.
 */
const LOCK_IDS: Record<string, number> = {
  "daily-seed": 737001,
  "backfill": 737002,
  "weekly-leagues": 737003,
};

/**
 * Execute `fn` while holding a Postgres session-level advisory lock.
 *
 * Uses pg_try_advisory_lock (non-blocking): if the lock is already held by
 * another connection (e.g., a concurrent Vercel cron retry), returns
 * `{ acquired: false }` immediately instead of waiting.
 *
 * Session-level locks (not transaction-level) are used because cron jobs
 * may run multiple transactions internally. The lock is explicitly released
 * in the finally block, and the connection is returned to the pool.
 */
export async function withAdvisoryLock<T>(
  jobName: string,
  fn: () => Promise<T>
): Promise<{ acquired: true; result: T } | { acquired: false }> {
  const lockId = LOCK_IDS[jobName];
  if (!lockId) throw new Error(`Unknown lock name: ${jobName}`);

  // Access the underlying pg.Pool from Drizzle's node-postgres driver
  const pool = (getDb() as any).$client as pg.Pool;
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [lockId]
    );

    if (!rows[0].acquired) {
      return { acquired: false };
    }

    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    }
  } finally {
    client.release();
  }
}
