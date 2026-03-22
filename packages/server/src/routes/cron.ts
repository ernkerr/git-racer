import { Hono } from "hono";
import { env } from "../lib/env.js";
import { db } from "../db/index.js";
import { seedState, suggestedOpponents, commitSnapshots, famousDevs } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { fetchTopGitHubUsers, fetchBatchContributionDays } from "../services/github.js";
import { seedFamousDevs, FAMOUS_DEV_LIST } from "../services/famous-devs.js";
import { finalizeWeek } from "../services/leagues.js";
import { ingestGHArchive } from "../services/gharchive.js";
import { ingestRealtimeEvents } from "../services/github-events.js";

export const cronRoutes = new Hono();

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

  const dateStr = new Date().toISOString().slice(0, 10);

  // --- Step 1: Refresh suggested opponents pool ---
  const topUsers = await fetchTopGitHubUsers(150);

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
  // Get cursor from seed_state (resume from where we left off)
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, "daily_seed"))
    .limit(1);

  const lastRunDate = state?.metadata
    ? (state.metadata as { date?: string }).date
    : null;
  // If we already completed a run for this date, skip
  const cursor = lastRunDate === dateStr ? (state?.cursor ?? 0) : 0;
  if (lastRunDate === dateStr && cursor === 0 && state?.last_run_at) {
    return c.json({ status: "already_seeded", date: dateStr });
  }

  // Build username list from the pool
  const pool = await db
    .select({ github_username: suggestedOpponents.github_username })
    .from(suggestedOpponents)
    .orderBy(suggestedOpponents.github_username);
  const usernames = pool.map((r) => r.github_username);

  // Fetch from cursor position
  const remaining = usernames.slice(cursor);
  const from = new Date(dateStr + "T00:00:00Z");
  const to = new Date(dateStr + "T23:59:59Z");

  const { data: contributionData, processed } =
    await fetchBatchContributionDays(remaining, from, to);

  // Store results in commit_snapshots
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

  // Update seed_state
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

  return c.json({
    status: completed ? "completed" : "partial",
    date: dateStr,
    users_processed: newCursor,
    users_total: usernames.length,
    snapshots_stored: rows.length,
  });
});

/**
 * Backfill cron job.
 * Fetches a date range for all users in the pool.
 * Used to seed initial weekly/monthly data or fill gaps.
 * Query params: days (number of days to backfill, default 7)
 */
cronRoutes.post("/backfill", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const daysBack = Math.min(parseInt(c.req.query("days") || "7", 10), 365);

  // Get cursor state
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, "backfill"))
    .limit(1);

  const cursor = state?.cursor ?? 0;

  // Get user pool
  const pool = await db
    .select({ github_username: suggestedOpponents.github_username })
    .from(suggestedOpponents)
    .orderBy(suggestedOpponents.github_username);
  const usernames = pool.map((r) => r.github_username);

  if (usernames.length === 0) {
    return c.json({ status: "no_users", message: "Run daily-seed first" });
  }

  // Compute date range
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() - 1); // yesterday
  const from = new Date(to);
  from.setDate(from.getDate() - daysBack + 1);

  const startStr = from.toISOString().slice(0, 10);
  const endStr = to.toISOString().slice(0, 10);

  // Fetch from cursor
  const remaining = usernames.slice(cursor);
  const { data: contributionData, processed } =
    await fetchBatchContributionDays(
      remaining,
      new Date(startStr + "T00:00:00Z"),
      new Date(endStr + "T23:59:59Z")
    );

  // Store results
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

  // Update cursor
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

  return c.json({
    status: completed ? "completed" : "partial",
    range: { from: startStr, to: endStr },
    users_processed: newCursor,
    users_total: usernames.length,
    snapshots_stored: rows.length,
  });
});

/**
 * Weekly league finalization + new week setup.
 * Should run every Monday morning.
 */
cronRoutes.post("/weekly-leagues", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Finalize last week
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek + 1 - 7);
  const lastWeekStart = lastMonday.toISOString().slice(0, 10);

  const result = await finalizeWeek(lastWeekStart);

  return c.json({
    status: "completed",
    finalized_week: lastWeekStart,
    ...result,
  });
});

/**
 * Seed famous devs table and ensure their contribution data is fetched.
 * Can be run once or periodically to refresh.
 */
cronRoutes.post("/seed-famous-devs", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Seed the famous_devs table
  const seeded = await seedFamousDevs();

  // Also add them to suggested_opponents so daily-seed fetches their contributions
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

  return c.json({ status: "completed", famous_devs_seeded: seeded });
});

/**
 * Ingest GH Archive public push events.
 * Downloads hourly archive files, extracts PushEvents, and aggregates
 * push counts per user into event_committers.
 * Processes one hour per call. Resumable — tracks which hours are done.
 * Query params: date (YYYY-MM-DD, defaults to today)
 */
cronRoutes.post("/ingest-events", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const date = c.req.query("date") || undefined;
  const result = await ingestGHArchive(date);
  return c.json({ status: "completed", ...result });
});

/**
 * Poll GitHub Events API for real-time push data.
 * Captures actual commit counts from PushEvent payloads.
 * Should run frequently (every few minutes) for the "Today" tab.
 */
cronRoutes.post("/poll-events", async (c) => {
  if (!verifyCronSecret(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await ingestRealtimeEvents();
  return c.json({ status: "completed", ...result });
});
