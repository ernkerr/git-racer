/**
 * Streak computation and caching service.
 *
 * Derives streak-related metrics from the per-day commit snapshots stored in
 * the database:
 *   - current_streak: consecutive days with commits ending today/yesterday.
 *   - longest_streak: the longest consecutive-day run ever recorded.
 *   - best_week_commits / best_week_start: the rolling 7-day window with
 *     the highest total.
 *   - this_week / last_week / trend_percent: week-over-week comparison.
 *
 * Results are cached in the `user_streaks` table for up to 4 hours. Even
 * when cached, the weekly totals are recomputed so the trend stays current.
 */

import { db } from "../db/index.js";
import { commitSnapshots, userStreaks } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import type { UserStreakInfo } from "@git-racer/shared";
import { today as getToday, weekStart, weekEnd } from "../lib/dates.js";

/** How long cached streak values are considered fresh before a full recalc. */
const STREAK_CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Compute streak metrics for a GitHub user and cache them.
 *
 * If the `user_streaks` cache row is younger than `STREAK_CACHE_MS`, returns
 * the cached streak/best-week values augmented with live this-week and
 * last-week totals (which are always queried fresh from `commit_snapshots`
 * so the trend percentage reflects today's data).
 *
 * When the cache is stale or missing, performs a full recalculation by
 * loading every daily snapshot row for the user, computing all metrics
 * in-memory, and upserting the results into `user_streaks`.
 *
 * @param githubUsername - GitHub login to compute streaks for.
 * @param userId - Optional internal user ID, stored alongside the cache row.
 * @returns The computed (or cached) streak info.
 */
export async function computeStreaks(
  githubUsername: string,
  userId?: number
): Promise<UserStreakInfo> {
  // Check cache first
  const [cached] = await db
    .select()
    .from(userStreaks)
    .where(eq(userStreaks.github_username, githubUsername))
    .limit(1);

  if (cached && Date.now() - cached.updated_at.getTime() < STREAK_CACHE_MS) {
    // Cache hit: streak values are still valid, but weekly totals must be
    // computed fresh so the trend percentage reflects today's data.
    const td = getToday();
    const thisWeekStart = weekStart();
    const prevWeekDate = new Date();
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const lastWeekStart = weekStart(prevWeekDate);
    const lastWeekEnd = weekEnd(prevWeekDate);

    // Single query uses conditional SUM to tally this-week and last-week
    // commits in one pass. The WHERE on lastWeekStart narrows the scan range.
    const weekResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN date >= ${thisWeekStart} AND date <= ${td} THEN commit_count ELSE 0 END), 0)::int AS this_week,
        COALESCE(SUM(CASE WHEN date >= ${lastWeekStart} AND date <= ${lastWeekEnd} THEN commit_count ELSE 0 END), 0)::int AS last_week
      FROM commit_snapshots
      WHERE github_username = ${githubUsername}
        AND date >= ${lastWeekStart}
    `);
    const wr = weekResult.rows[0] as any;
    const thisWeek = Number(wr.this_week);
    const lastWeek = Number(wr.last_week);

    // Week-over-week trend: percentage change from last week to this week.
    // If last week was zero, report +100% when there are commits, else 0%.
    const trendPercent = lastWeek > 0
      ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
      : thisWeek > 0 ? 100 : 0;

    return {
      current_streak: cached.current_streak,
      longest_streak: cached.longest_streak,
      best_week_commits: cached.best_week_commits,
      best_week_start: cached.best_week_start,
      this_week: thisWeek,
      last_week: lastWeek,
      trend_percent: trendPercent,
    };
  }

  // Full recalculation — get all daily contribution data
  const days = await db
    .select({
      date: commitSnapshots.date,
      count: commitSnapshots.commit_count,
    })
    .from(commitSnapshots)
    .where(eq(commitSnapshots.github_username, githubUsername))
    .orderBy(desc(commitSnapshots.date));

  if (days.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      best_week_commits: 0,
      best_week_start: null,
      this_week: 0,
      last_week: 0,
      trend_percent: 0,
    };
  }

  // --- Current streak ---
  // Walk backward from today (or yesterday if no commits today yet).
  // Each consecutive day with commits increments the streak counter;
  // the first zero-commit day breaks the chain.
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  let currentStreak = 0;
  const dayMap = new Map(days.map((d) => [d.date, d.count]));

  // Allow a grace period: if the user hasn't committed yet today,
  // start counting from yesterday so the streak isn't prematurely broken.
  let checkDate = new Date(today);
  if (!dayMap.has(todayStr) || dayMap.get(todayStr) === 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateKey = checkDate.toISOString().slice(0, 10);
    const count = dayMap.get(dateKey) ?? 0;
    if (count > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // --- Longest streak ---
  // Sort chronologically and scan forward. For each day with commits,
  // check if it's exactly 1 day after the previous active day. If so,
  // extend the running streak; otherwise reset to 1. Track the maximum.
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longestStreak = 0;
  let streak = 0;
  let prevDate: Date | null = null;

  for (const day of sortedDays) {
    if (day.count <= 0) {
      streak = 0;
      prevDate = null;
      continue;
    }

    const d = new Date(day.date + "T00:00:00Z");
    if (prevDate) {
      // 86400000 ms = 1 day; exact integer comparison avoids DST issues
      // because we pin to midnight UTC.
      const diff = (d.getTime() - prevDate.getTime()) / 86400000;
      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    prevDate = d;
    longestStreak = Math.max(longestStreak, streak);
  }

  // --- Best week ---
  // Slide a 7-day window across the chronologically sorted days and find
  // the window with the highest total commit count. If fewer than 7 days
  // of data exist, use all available days as a single partial window.
  let bestWeekCommits = 0;
  let bestWeekStart: string | null = null;

  if (sortedDays.length >= 7) {
    for (let i = 0; i <= sortedDays.length - 7; i++) {
      let sum = 0;
      for (let j = i; j < i + 7; j++) {
        sum += sortedDays[j].count;
      }
      if (sum > bestWeekCommits) {
        bestWeekCommits = sum;
        bestWeekStart = sortedDays[i].date;
      }
    }
  } else {
    const sum = sortedDays.reduce((s, d) => s + d.count, 0);
    if (sum > 0) {
      bestWeekCommits = sum;
      bestWeekStart = sortedDays[0].date;
    }
  }

  // --- This week vs last week (trend calculation) ---
  // Determine the ISO week boundaries (Monday-Sunday) for this week and
  // last week, then sum commits in each range from the in-memory data.
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // Convert Sunday (0) to 7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const thisWeekStart = monday.toISOString().slice(0, 10);

  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekStart = lastMonday.toISOString().slice(0, 10);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  const lastWeekEnd = lastSunday.toISOString().slice(0, 10);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const day of days) {
    if (day.date >= thisWeekStart && day.date <= todayStr) {
      thisWeek += day.count;
    }
    if (day.date >= lastWeekStart && day.date <= lastWeekEnd) {
      lastWeek += day.count;
    }
  }

  // Percentage change: ((this - last) / last) * 100
  // Edge cases: if last week was zero, treat any activity as +100%, none as 0%.
  const trendPercent = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    : thisWeek > 0 ? 100 : 0;

  // Persist the computed streaks into user_streaks (upsert on github_username)
  // so subsequent calls within the TTL window can skip the full recalc.
  // `days` is sorted descending, so days[0] is the most recent active date.
  const lastActiveDate = days[0]?.date ?? null;
  await db
    .insert(userStreaks)
    .values({
      user_id: userId ?? null,
      github_username: githubUsername,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      best_week_commits: bestWeekCommits,
      best_week_start: bestWeekStart,
      last_active_date: lastActiveDate,
    })
    .onConflictDoUpdate({
      target: userStreaks.github_username,
      set: {
        current_streak: sql`${currentStreak}`,
        longest_streak: sql`${longestStreak}`,
        best_week_commits: sql`${bestWeekCommits}`,
        best_week_start: bestWeekStart ? sql`${bestWeekStart}` : sql`null`,
        last_active_date: lastActiveDate ? sql`${lastActiveDate}` : sql`null`,
        updated_at: sql`now()`,
      },
    });

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    best_week_commits: bestWeekCommits,
    best_week_start: bestWeekStart,
    this_week: thisWeek,
    last_week: lastWeek,
    trend_percent: trendPercent,
  };
}
