import { db } from "../db/index.js";
import { commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { CACHE_TTL_MS } from "@git-racer/shared";
import { fetchContributionDays, fetchContributionYears } from "./github.js";
import { today, weekStart, monthStart, yearStart } from "../lib/dates.js";

/**
 * Ensure we have fresh commit data for a user, fetching from GitHub if stale.
 * Returns true if data was already fresh (skipped refresh).
 */
export async function refreshCommitData(
  githubUsername: string,
  token?: string
): Promise<boolean> {
  const latest = await db
    .select({ fetched_at: commitSnapshots.fetched_at })
    .from(commitSnapshots)
    .where(eq(commitSnapshots.github_username, githubUsername))
    .orderBy(desc(commitSnapshots.fetched_at))
    .limit(1);

  if (latest.length > 0) {
    const age = Date.now() - latest[0].fetched_at.getTime();
    if (age < CACHE_TTL_MS) return true; // Still fresh
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const days = await fetchContributionDays(githubUsername, yearStart, now, token);

  if (days.length > 0) {
    await db
      .insert(commitSnapshots)
      .values(
        days.map((d) => ({
          github_username: githubUsername,
          date: d.date,
          commit_count: d.count,
          fetched_at: now,
        }))
      )
      .onConflictDoUpdate({
        target: [commitSnapshots.github_username, commitSnapshots.date],
        set: {
          commit_count: sql`excluded.commit_count`,
          fetched_at: sql`excluded.fetched_at`,
        },
      });
  }

  return false;
}

/**
 * Ensure we have all historical years loaded (for all-time stats).
 * Expensive — only call from /me/stats, not dashboard.
 */
export async function refreshAllTimeData(
  githubUsername: string,
  token?: string
): Promise<void> {
  const years = await fetchContributionYears(githubUsername, token);
  const currentYear = new Date().getFullYear();

  for (const year of years) {
    if (year === currentYear) continue;

    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(commitSnapshots)
      .where(
        and(
          eq(commitSnapshots.github_username, githubUsername),
          gte(commitSnapshots.date, `${year}-01-01`),
          lte(commitSnapshots.date, `${year}-12-31`)
        )
      );

    if (existing[0].count > 0) continue;

    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31);
    const days = await fetchContributionDays(githubUsername, from, to, token);

    if (days.length > 0) {
      await db
        .insert(commitSnapshots)
        .values(
          days.map((d) => ({
            github_username: githubUsername,
            date: d.date,
            commit_count: d.count,
            fetched_at: new Date(),
          }))
        )
        .onConflictDoUpdate({
          target: [commitSnapshots.github_username, commitSnapshots.date],
          set: {
            commit_count: sql`excluded.commit_count`,
            fetched_at: sql`excluded.fetched_at`,
          },
        });
    }
  }
}

/**
 * Get the sum of commits between two dates for a user.
 */
export async function getCommitCount(
  githubUsername: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const result = await db
    .select({ total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)` })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, githubUsername),
        gte(commitSnapshots.date, startDate),
        lte(commitSnapshots.date, endDate)
      )
    );

  return Number(result[0].total);
}

/**
 * Fast stats for dashboard — single SQL query, no all-time refresh.
 * Assumes refreshCommitData was already called by the caller.
 */
export async function getUserStatsFast(
  githubUsername: string
): Promise<{
  today: number;
  this_week: number;
  this_month: number;
  this_year: number;
  all_time: number;
}> {
  const t = today();
  const w = weekStart();
  const m = monthStart();
  const y = yearStart();

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN date = ${t} THEN commit_count ELSE 0 END), 0)::int AS today,
      COALESCE(SUM(CASE WHEN date >= ${w} THEN commit_count ELSE 0 END), 0)::int AS this_week,
      COALESCE(SUM(CASE WHEN date >= ${m} THEN commit_count ELSE 0 END), 0)::int AS this_month,
      COALESCE(SUM(CASE WHEN date >= ${y} THEN commit_count ELSE 0 END), 0)::int AS this_year,
      COALESCE(SUM(commit_count), 0)::int AS all_time
    FROM commit_snapshots
    WHERE github_username = ${githubUsername}
  `);

  const r = result.rows[0] as any;
  return {
    today: Number(r.today),
    this_week: Number(r.this_week),
    this_month: Number(r.this_month),
    this_year: Number(r.this_year),
    all_time: Number(r.all_time),
  };
}

/**
 * Full stats with all-time historical refresh — used by /me/stats endpoint.
 */
export async function getUserStats(
  githubUsername: string,
  token?: string
): Promise<{
  today: number;
  this_week: number;
  this_month: number;
  this_year: number;
  all_time: number;
}> {
  await refreshCommitData(githubUsername, token);
  await refreshAllTimeData(githubUsername, token);
  return getUserStatsFast(githubUsername);
}
