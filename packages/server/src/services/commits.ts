import { db } from "../db/index.js";
import { commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { CACHE_TTL_MS } from "@git-racer/shared";
import { fetchContributionDays, fetchContributionYears } from "./github.js";

/**
 * Ensure we have fresh commit data for a user, fetching from GitHub if stale.
 */
export async function refreshCommitData(
  githubUsername: string,
  token?: string
): Promise<void> {
  // Check staleness: find the most recent fetched_at for this user
  const latest = await db
    .select({ fetched_at: commitSnapshots.fetched_at })
    .from(commitSnapshots)
    .where(eq(commitSnapshots.github_username, githubUsername))
    .orderBy(desc(commitSnapshots.fetched_at))
    .limit(1);

  if (latest.length > 0) {
    const age = Date.now() - latest[0].fetched_at.getTime();
    if (age < CACHE_TTL_MS) return; // Still fresh
  }

  // Fetch current year contributions
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const days = await fetchContributionDays(githubUsername, yearStart, now, token);

  // Upsert all days
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
}

/**
 * Ensure we have all historical years loaded (for all-time stats).
 */
export async function refreshAllTimeData(
  githubUsername: string,
  token?: string
): Promise<void> {
  const years = await fetchContributionYears(githubUsername, token);
  const currentYear = new Date().getFullYear();

  for (const year of years) {
    if (year === currentYear) continue; // Already handled by refreshCommitData

    // Check if we have any data for this year
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

    if (existing[0].count > 0) continue; // Already have this year

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
 * Get aggregated stats for a user: today, this_week, this_month, this_year, all_time.
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
  // Refresh current year data
  await refreshCommitData(githubUsername, token);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Monday of this week (ISO week)
  const dayOfWeek = now.getDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekStartStr = monday.toISOString().slice(0, 10);

  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStartStr = `${now.getFullYear()}-01-01`;

  const [today, thisWeek, thisMonth, thisYear] = await Promise.all([
    getCommitCount(githubUsername, todayStr, todayStr),
    getCommitCount(githubUsername, weekStartStr, todayStr),
    getCommitCount(githubUsername, monthStartStr, todayStr),
    getCommitCount(githubUsername, yearStartStr, todayStr),
  ]);

  // All-time: load historical years if needed, then sum everything
  await refreshAllTimeData(githubUsername, token);
  const allTimeResult = await db
    .select({ total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)` })
    .from(commitSnapshots)
    .where(eq(commitSnapshots.github_username, githubUsername));

  return {
    today,
    this_week: thisWeek,
    this_month: thisMonth,
    this_year: thisYear,
    all_time: Number(allTimeResult[0].total),
  };
}
