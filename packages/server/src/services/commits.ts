/**
 * Commit data ingestion and aggregation service.
 *
 * Manages the local cache of per-day commit snapshots sourced from the
 * GitHub Contributions API. Provides functions to refresh the cache when
 * stale, back-fill historical years, and query aggregated commit counts
 * across various time windows (today, week, month, year, all-time).
 */

import { db } from "../db/index.js";
import { commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { CACHE_TTL_MS } from "@git-racer/shared";
import { fetchContributionDays, fetchContributionYears } from "./github.js";
import { today, weekStart, monthStart, yearStart } from "../lib/dates.js";

/**
 * Ensure we have fresh commit data for a user by checking the most recent
 * snapshot timestamp against `CACHE_TTL_MS`. If the data is stale (or
 * missing), fetches the current calendar year's contributions from GitHub
 * and upserts them into the `commit_snapshots` table.
 *
 * @param githubUsername - The GitHub login to refresh data for.
 * @param token - Optional OAuth token; falls back to the server app token.
 * @returns `true` if the cached data was still fresh and no fetch was needed,
 *          `false` if new data was fetched and stored.
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
    const ageMs = Date.now() - latest[0].fetched_at.getTime();
    if (ageMs < CACHE_TTL_MS) {
      console.log(`[commits] ${githubUsername}: cache fresh (age=${Math.round(ageMs/1000)}s)`);
      return true;
    }
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const contributionDays = await fetchContributionDays(githubUsername, startOfYear, now, token);

  if (contributionDays.length > 0) {
    // Upsert each day's commit count. On conflict (same user + date),
    // overwrite with the latest fetched values so counts stay current.
    await db
      .insert(commitSnapshots)
      .values(
        contributionDays.map((day) => ({
          github_username: githubUsername,
          date: day.date,
          commit_count: day.count,
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
 * Back-fill commit snapshots for every historical year the user has been
 * active on GitHub. This is expensive (one GitHub API call per year) and
 * should only be called from the full `/me/stats` endpoint, never from
 * the dashboard hot path.
 *
 * Skips the current year (already covered by `refreshCommitData`) and any
 * year that already has rows in the database.
 *
 * @param githubUsername - The GitHub login to back-fill history for.
 * @param token - Optional OAuth token; falls back to the server app token.
 */
export async function refreshAllTimeData(
  githubUsername: string,
  token?: string
): Promise<void> {
  const years = await fetchContributionYears(githubUsername, token);
  const currentYear = new Date().getFullYear();

  for (const year of years) {
    // Current year is handled by refreshCommitData; skip it here.
    if (year === currentYear) continue;

    // Check if we already have any rows for this year to avoid redundant fetches.
    const existingRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(commitSnapshots)
      .where(
        and(
          eq(commitSnapshots.github_username, githubUsername),
          gte(commitSnapshots.date, `${year}-01-01`),
          lte(commitSnapshots.date, `${year}-12-31`)
        )
      );

    if (existingRows[0].count > 0) continue;

    const yearFrom = new Date(year, 0, 1);
    const yearTo = new Date(year, 11, 31);
    const contributionDays = await fetchContributionDays(githubUsername, yearFrom, yearTo, token);

    if (contributionDays.length > 0) {
      // Same upsert strategy as refreshCommitData — idempotent per (user, date).
      await db
        .insert(commitSnapshots)
        .values(
          contributionDays.map((day) => ({
            github_username: githubUsername,
            date: day.date,
            commit_count: day.count,
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
 * Sum the cached commit counts for a user within an inclusive date range.
 *
 * @param githubUsername - The GitHub login to query.
 * @param startDate - Inclusive start date in "YYYY-MM-DD" format.
 * @param endDate - Inclusive end date in "YYYY-MM-DD" format.
 * @returns The total number of commits in the range (0 if no data).
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
 * Lightweight stats lookup for the dashboard. Computes today / week / month /
 * year / all-time commit totals in a single SQL query using conditional
 * aggregation, avoiding multiple round-trips.
 *
 * Callers must ensure `refreshCommitData` has already been called so the
 * underlying snapshot rows are up to date.
 *
 * @param githubUsername - The GitHub login to aggregate stats for.
 * @returns An object with commit totals for each time window.
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
  const todayDate = today();
  const weekStartDate = weekStart();
  const monthStartDate = monthStart();
  const yearStartDate = yearStart();

  // Single-pass conditional aggregation: each CASE branch filters rows into
  // the appropriate time bucket. The unfiltered SUM covers all-time.
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN date = ${todayDate} THEN commit_count ELSE 0 END), 0)::int AS today,
      COALESCE(SUM(CASE WHEN date >= ${weekStartDate} THEN commit_count ELSE 0 END), 0)::int AS this_week,
      COALESCE(SUM(CASE WHEN date >= ${monthStartDate} THEN commit_count ELSE 0 END), 0)::int AS this_month,
      COALESCE(SUM(CASE WHEN date >= ${yearStartDate} THEN commit_count ELSE 0 END), 0)::int AS this_year,
      COALESCE(SUM(commit_count), 0)::int AS all_time
    FROM commit_snapshots
    WHERE github_username = ${githubUsername}
  `);

  const row = result.rows[0] as any;
  return {
    today: Number(row.today),
    this_week: Number(row.this_week),
    this_month: Number(row.this_month),
    this_year: Number(row.this_year),
    all_time: Number(row.all_time),
  };
}

/**
 * Full stats including all-time historical data. Refreshes both the current
 * year and every historical year before aggregating, so the result includes
 * a complete all-time total. Used by the `/me/stats` endpoint where
 * accuracy matters more than latency.
 *
 * @param githubUsername - The GitHub login to compute stats for.
 * @param token - Optional OAuth token; falls back to the server app token.
 * @returns Commit totals for today, this week, this month, this year, and all-time.
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
