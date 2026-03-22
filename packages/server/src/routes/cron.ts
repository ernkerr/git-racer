/**
 * Cron job routes -- scheduled background tasks for data ingestion and maintenance.
 *
 * All endpoints are protected by a shared Bearer token (CRON_SECRET) and use
 * PostgreSQL advisory locks to prevent concurrent execution of the same job.
 *
 * Endpoints:
 *   POST /daily-seed       Refresh the suggested opponents pool and fetch today's contributions
 *   POST /backfill         Backfill contribution data for a configurable date range
 *   POST /weekly-leagues   Finalize the previous week's league standings
 *   POST /seed-famous-devs Populate the famous developers reference table
 *   POST /ingest-events    Ingest push events from GH Archive (one hour per call)
 *   POST /poll-events      Poll the GitHub Events API for near-real-time push data
 */
import { Hono } from "hono";
import { env } from "../lib/env.js";
import { db } from "../db/index.js";
import { seedState, suggestedOpponents, commitSnapshots } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { fetchTopGitHubUsers, fetchBatchContributionDays } from "../services/github.js";
import { seedFamousDevs, FAMOUS_DEV_LIST } from "../services/famous-devs.js";
import { finalizeWeek } from "../services/leagues.js";
import { ingestGHArchive } from "../services/gharchive.js";
import { ingestRealtimeEvents } from "../services/github-events.js";
import { withAdvisoryLock } from "../lib/advisory-lock.js";

export const cronRoutes = new Hono();

/** Verify the request carries the correct CRON_SECRET bearer token. */
function verifyCronSecret(authHeader: string | undefined): boolean {
  if (!env.CRON_SECRET) return false;
  return authHeader === `Bearer ${env.CRON_SECRET}`;
}

/**
 * Daily seed cron job.
 * 1. Refresh the suggested_opponents pool (top GitHub users by followers)
 * 2. Fetch today's contribution data for all users in the pool
 * 3. Store in commit_snapshots, resumable via cursor on rate limit
 */
cronRoutes.post("/daily-seed", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const lockResult = await withAdvisoryLock("daily-seed", async () => {
    const dateStr = new Date().toISOString().slice(0, 10);

    // --- Step 1: Refresh suggested opponents pool ---
    const topUsers = await fetchTopGitHubUsers(150);

    // Upsert top GitHub users into the suggested_opponents table in chunks of 50
    // to stay within Postgres parameter limits. On conflict, update the
    // avatar/follower count so stale data doesn't linger.
    if (topUsers.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < topUsers.length; i += chunkSize) {
        const chunk = topUsers.slice(i, i + chunkSize);
        await db
          .insert(suggestedOpponents)
          .values(
            chunk.map((u) => ({
              github_username: u.login,
              avatar_url: u.avatar_url,
              followers: u.followers,
            }))
          )
          .onConflictDoUpdate({
            target: suggestedOpponents.github_username,
            set: {
              avatar_url: sql`excluded.avatar_url`,
              followers: sql`excluded.followers`,
              fetched_at: sql`now()`,
            },
          });
      }
    }

    // --- Step 2: Fetch today's contributions ---
    // The seed_state row tracks resumable progress. If the date changed, reset
    // the cursor. If cursor is 0 and last_run_at is set, the job already
    // completed today -- skip early.
    const [state] = await db
      .select()
      .from(seedState)
      .where(eq(seedState.key, "daily_seed"))
      .limit(1);

    const lastRunDate = state?.metadata
      ? (state.metadata as { date?: string }).date
      : null;
    const cursor = lastRunDate === dateStr ? (state?.cursor ?? 0) : 0;
    if (lastRunDate === dateStr && cursor === 0 && state?.last_run_at) {
      return { status: "already_seeded" as const, date: dateStr };
    }

    const pool = await db
      .select({ github_username: suggestedOpponents.github_username })
      .from(suggestedOpponents)
      .orderBy(suggestedOpponents.github_username);
    const usernames = pool.map((r) => r.github_username);

    // Resume from where we left off (cursor) to handle GitHub rate limits gracefully
    const remaining = usernames.slice(cursor);
    const from = new Date(dateStr + "T00:00:00Z");
    const to = new Date(dateStr + "T23:59:59Z");

    const { data: contributionData, processed } =
      await fetchBatchContributionDays(remaining, from, to);

    // Flatten the per-user contribution days into snapshot rows for today only
    const rows: { github_username: string; date: string; commit_count: number }[] = [];
    for (const [username, days] of contributionData) {
      for (const day of days) {
        if (day.date === dateStr) {
          rows.push({
            github_username: username,
            date: day.date,
            commit_count: day.count,
          });
        }
      }
    }

    // Upsert snapshots in chunks of 500 to stay within Postgres parameter limits
    if (rows.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await db
          .insert(commitSnapshots)
          .values(chunk)
          .onConflictDoUpdate({
            target: [commitSnapshots.github_username, commitSnapshots.date],
            set: {
              commit_count: sql`excluded.commit_count`,
              fetched_at: sql`now()`,
            },
          });
      }
    }

    // Persist progress: reset cursor to 0 when finished, otherwise save
    // the current position so the next invocation picks up where we stopped.
    const newCursor = cursor + processed;
    const completed = newCursor >= usernames.length;

    await db
      .insert(seedState)
      .values({
        key: "daily_seed",
        last_run_at: completed ? new Date() : null,
        cursor: completed ? 0 : newCursor,
        metadata: { date: dateStr },
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: completed ? sql`now()` : seedState.last_run_at,
          cursor: completed ? sql`0` : sql`${newCursor}`,
          metadata: sql`${JSON.stringify({ date: dateStr })}::jsonb`,
          updated_at: sql`now()`,
        },
      });

    return {
      status: (completed ? "completed" : "partial") as string,
      date: dateStr,
      users_processed: newCursor,
      users_total: usernames.length,
      snapshots_stored: rows.length,
    };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Backfill cron job.
 * Fetches a date range for all users in the pool.
 * Used to seed initial weekly/monthly data or fill gaps.
 */
cronRoutes.post("/backfill", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Cap at 365 days to avoid unbounded historical fetches
  const daysBack = Math.min(parseInt(c.req.query("days") || "7", 10), 365);

  const lockResult = await withAdvisoryLock("backfill", async () => {
    const [state] = await db
      .select()
      .from(seedState)
      .where(eq(seedState.key, "backfill"))
      .limit(1);

    const cursor = state?.cursor ?? 0;

    const pool = await db
      .select({ github_username: suggestedOpponents.github_username })
      .from(suggestedOpponents)
      .orderBy(suggestedOpponents.github_username);
    const usernames = pool.map((r) => r.github_username);

    if (usernames.length === 0) {
      return { status: "no_users", message: "Run daily-seed first" };
    }

    // Build the date range: from (daysBack) days ago up to yesterday (exclusive of today)
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - daysBack + 1);

    const startStr = from.toISOString().slice(0, 10);
    const endStr = to.toISOString().slice(0, 10);

    const remaining = usernames.slice(cursor);
    const { data: contributionData, processed } =
      await fetchBatchContributionDays(
        remaining,
        new Date(startStr + "T00:00:00Z"),
        new Date(endStr + "T23:59:59Z")
      );

    const rows: { github_username: string; date: string; commit_count: number }[] = [];
    for (const [username, days] of contributionData) {
      for (const day of days) {
        if (day.date >= startStr && day.date <= endStr) {
          rows.push({
            github_username: username,
            date: day.date,
            commit_count: day.count,
          });
        }
      }
    }

    if (rows.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await db
          .insert(commitSnapshots)
          .values(chunk)
          .onConflictDoUpdate({
            target: [commitSnapshots.github_username, commitSnapshots.date],
            set: {
              commit_count: sql`excluded.commit_count`,
              fetched_at: sql`now()`,
            },
          });
      }
    }

    const newCursor = cursor + processed;
    const completed = newCursor >= usernames.length;

    await db
      .insert(seedState)
      .values({
        key: "backfill",
        last_run_at: completed ? new Date() : null,
        cursor: completed ? 0 : newCursor,
        metadata: { from: startStr, to: endStr, days: daysBack },
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: completed ? sql`now()` : seedState.last_run_at,
          cursor: completed ? sql`0` : sql`${newCursor}`,
          metadata: sql`${JSON.stringify({ from: startStr, to: endStr, days: daysBack })}::jsonb`,
          updated_at: sql`now()`,
        },
      });

    return {
      status: completed ? "completed" : "partial",
      range: { from: startStr, to: endStr },
      users_processed: newCursor,
      users_total: usernames.length,
      snapshots_stored: rows.length,
    };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Weekly league finalization + new week setup.
 * Should run every Monday morning.
 */
cronRoutes.post("/weekly-leagues", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const lockResult = await withAdvisoryLock("weekly-leagues", async () => {
    // Calculate last Monday: getDay() returns 0 for Sunday, so we normalize
    // with `|| 7` to treat Sunday as day 7, then subtract back to the previous week's Monday.
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek + 1 - 7);
    const lastWeekStart = lastMonday.toISOString().slice(0, 10);

    const result = await finalizeWeek(lastWeekStart);

    return {
      status: "completed",
      finalized_week: lastWeekStart,
      ...result,
    };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Seed famous devs table and ensure their contribution data is fetched.
 */
cronRoutes.post("/seed-famous-devs", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const lockResult = await withAdvisoryLock("seed-famous-devs", async () => {
    const seeded = await seedFamousDevs();

    // Also add famous devs to the suggested_opponents table so they appear
    // in search results and their commit data gets fetched by the daily seed.
    const devUsernames = FAMOUS_DEV_LIST.map((d) => d.github_username);
    const chunkSize = 50;
    for (let i = 0; i < devUsernames.length; i += chunkSize) {
      const chunk = devUsernames.slice(i, i + chunkSize);
      await db
        .insert(suggestedOpponents)
        .values(
          chunk.map((username) => ({
            github_username: username,
            avatar_url: `https://github.com/${username}.png`,
            followers: 0,
          }))
        )
        .onConflictDoNothing();
    }

    return { status: "completed", famous_devs_seeded: seeded };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Ingest GH Archive public push events.
 * Processes one hour per call. Resumable — tracks which hours are done.
 */
cronRoutes.post("/ingest-events", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const lockResult = await withAdvisoryLock("ingest-events", async () => {
    const date = c.req.query("date") || undefined;
    const result = await ingestGHArchive(date);
    const enrichResult = await enrichTopUsers(result.date);
    return { status: "completed", ...result, enriched: enrichResult };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Poll GitHub Events API for real-time push data.
 */
cronRoutes.post("/poll-events", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const lockResult = await withAdvisoryLock("poll-events", async () => {
    const result = await ingestRealtimeEvents();
    return { status: "completed", ...result };
  });

  if (!lockResult.acquired) {
    return c.json({ status: "skipped", reason: "already_running" });
  }
  return c.json(lockResult.result);
});

/**
 * Fetch accurate commit counts for the day's top committers from the
 * GitHub GraphQL contributions API and store them in commit_snapshots.
 *
 * GH Archive push events give us an approximate count; this enrichment
 * step replaces those estimates with the user's real contribution numbers.
 *
 * @param date - ISO date string (YYYY-MM-DD) to enrich
 * @param topN - Number of top committers to enrich (default: 10)
 * @returns The number of users whose snapshots were updated
 */
async function enrichTopUsers(
  date: string,
  topN: number = 10
): Promise<{ users_enriched: number }> {
  try {
    // Find the top N committers from the event_committers table for the given date
    const topRows = await db.execute(sql`
      SELECT github_username, commit_count
      FROM event_committers
      WHERE date = ${date}
      ORDER BY commit_count DESC
      LIMIT ${topN}
    `);

    const usernames = topRows.rows.map((r: any) => r.github_username as string);
    if (usernames.length === 0) return { users_enriched: 0 };

    const from = new Date(date + "T00:00:00Z");
    const to = new Date(date + "T23:59:59Z");
    const { data: contribData } = await fetchBatchContributionDays(usernames, from, to);

    const rows: { github_username: string; date: string; commit_count: number }[] = [];
    for (const [username, days] of contribData) {
      for (const day of days) {
        if (day.date === date && day.count > 0) {
          rows.push({
            github_username: username,
            date: day.date,
            commit_count: day.count,
          });
        }
      }
    }

    if (rows.length > 0) {
      await db
        .insert(commitSnapshots)
        .values(rows)
        .onConflictDoUpdate({
          target: [commitSnapshots.github_username, commitSnapshots.date],
          set: {
            commit_count: sql`excluded.commit_count`,
            fetched_at: sql`now()`,
          },
        });
    }

    return { users_enriched: rows.length };
  } catch (err) {
    console.error("[enrich] Failed to enrich top users:", err);
    return { users_enriched: 0 };
  }
}
