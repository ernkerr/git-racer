/**
 * Authenticated "me" routes -- current user profile, dashboard aggregation,
 * and share-card text generation.
 *
 * All routes require a valid session JWT (enforced by the requireAuth
 * middleware applied at the top).
 */
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getUserStatsFast, refreshCommitData } from "../services/commits.js";
import { computeStreaks } from "../services/streaks.js";
import { today, weekStart, isoWeek } from "../lib/dates.js";
import type { AppEnv } from "../types.js";
import { env } from "../lib/env.js";
import type { ContributionDay } from "@git-racer/shared";

export const meRoutes = new Hono<AppEnv>();

// Every route in this module requires an authenticated user
meRoutes.use("*", requireAuth);

/** GET /me -- Return the authenticated user's public profile fields. */
meRoutes.get("/", async (c) => {
  const { sub: userId } = c.get("user");

  const [user] = await db
    .select({
      id: users.id,
      github_id: users.github_id,
      github_username: users.github_username,
      avatar_url: users.avatar_url,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

/**
 * GET /me/dashboard
 *
 * Consolidated dashboard endpoint -- fetches stats, active challenges,
 * streak info, and the contribution graph in a single request so the
 * client only needs one round-trip to render the full dashboard.
 */
meRoutes.get("/dashboard", async (c) => {
  const { sub: userId, username } = c.get("user");

  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  // Eagerly refresh commit data from GitHub before building the dashboard.
  // This is best-effort; if it fails the dashboard still loads with stale data.
  try {
    await refreshCommitData(username, user.access_token);
  } catch (e) {
    console.error("refreshCommitData failed:", e);
  }

  const now = new Date();
  const todayStr = today();

  // Fetch all four data sources in parallel. Each call has a .catch()
  // fallback so that one failing source does not break the entire dashboard.
  const [stats, challengeRows, streakInfo, contribDays] = await Promise.all([
    // Commit-count buckets (today, week, month, year, all-time)
    getUserStatsFast(username).catch(() => ({ today: 0, this_week: 0, this_month: 0, this_year: 0, all_time: 0 })),

    // Challenges query: uses two CTEs --
    //   1. user_challenges:     all challenges the current user participates in
    //   2. participant_commits: per-participant commit totals scoped to each challenge's date range
    // The final SELECT enriches each challenge with participant_count,
    // the current user's commit total, and the overall leader.
    db.execute(sql`
      WITH user_challenges AS (
        SELECT c.id, c.name, c.type, c.duration_type, c.refresh_period, c.share_slug, c.end_date, c.start_date, c.created_at
        FROM challenges c
        INNER JOIN challenge_participants cp ON cp.challenge_id = c.id
        WHERE cp.github_username = ${username}
      ),
      participant_commits AS (
        SELECT
          cp.challenge_id,
          cp.github_username,
          COALESCE(SUM(cs.commit_count), 0)::int AS commits
        FROM challenge_participants cp
        INNER JOIN user_challenges uc ON uc.id = cp.challenge_id
        LEFT JOIN commit_snapshots cs
          ON cs.github_username = cp.github_username
          AND cs.date >= CASE
            WHEN uc.refresh_period = 'daily' THEN ${todayStr}
            WHEN uc.refresh_period = 'weekly' THEN ${weekStart()}
            ELSE uc.start_date::date::text
          END
          AND cs.date <= COALESCE(uc.end_date::date::text, ${todayStr})
        GROUP BY cp.challenge_id, cp.github_username
      )
      SELECT
        uc.id,
        uc.name,
        uc.type,
        uc.duration_type,
        uc.refresh_period,
        uc.share_slug,
        uc.end_date,
        (SELECT COUNT(*)::int FROM challenge_participants cp2 WHERE cp2.challenge_id = uc.id) AS participant_count,
        COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id AND pc.github_username = ${username}), 0) AS your_commits,
        COALESCE((SELECT github_username FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), '') AS leader_username,
        COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), 0) AS leader_commits
      FROM user_challenges uc
      ORDER BY uc.created_at DESC
    `).catch((e) => { console.error("challenge query failed:", e); return { rows: [] }; }),

    // Current and longest streaks for the user
    computeStreaks(username, userId).catch(() => null),

    // Contribution graph data: daily commit counts for the past 365 days.
    // Wrapped in an IIFE so the date math runs inline within Promise.all.
    (() => {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      yearAgo.setDate(yearAgo.getDate() + 1); // start one day after "a year ago" for exactly 365 days
      return db
        .select({ date: commitSnapshots.date, count: commitSnapshots.commit_count })
        .from(commitSnapshots)
        .where(
          and(
            eq(commitSnapshots.github_username, username),
            gte(commitSnapshots.date, yearAgo.toISOString().slice(0, 10)),
            lte(commitSnapshots.date, todayStr)
          )
        )
        .orderBy(commitSnapshots.date);
    })().catch(() => []),
  ]);

  const contributions = buildContributionGraph(contribDays, now);

  // Normalize the raw SQL rows into a clean JSON shape with proper types.
  // end_date may come back as a Date object or string depending on the
  // driver, so the ?.toISOString?.() chain handles both cases gracefully.
  const challenges = challengeRows.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    duration_type: r.duration_type,
    refresh_period: r.refresh_period ?? "ongoing",
    share_slug: r.share_slug,
    end_date: r.end_date?.toISOString?.() ?? r.end_date ?? null,
    your_commits: Number(r.your_commits),
    leader_username: r.leader_username,
    leader_commits: Number(r.leader_commits),
    participant_count: Number(r.participant_count),
  }));

  return c.json({ stats, challenges, streaks: streakInfo, contributions });
});

/**
 * GET /me/share
 *
 * Generates a plain-text share card summarizing the user's current week:
 * total commits, per-day breakdown (Mon--Sun), active streak, and
 * week-over-week trend. Intended for copy-paste sharing.
 */
meRoutes.get("/share", async (c) => {
  const { username } = c.get("user");

  const now = new Date();
  const weekLabel = `W${isoWeek(now)} ${now.getFullYear()}`;
  const weekStartDate = weekStart();
  const todayStr = today();

  // Fetch commit snapshots for the current ISO week
  const days = await db
    .select({ date: commitSnapshots.date, count: commitSnapshots.commit_count })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, weekStartDate),
        lte(commitSnapshots.date, todayStr)
      )
    )
    .orderBy(commitSnapshots.date);

  const streakInfo = await computeStreaks(username);

  // Build an array of daily commit counts from Monday to today.
  // getDay() returns 0 for Sunday, so we map it to 7 for ISO week alignment.
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const dailyCounts: number[] = [];
  const cursor = new Date(monday);
  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    dailyCounts.push(days.find((d) => d.date === dateKey)?.count ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalWeekCommits = days.reduce((sum, d) => sum + d.count, 0);
  const trendStr = streakInfo.trend_percent >= 0
    ? `+${streakInfo.trend_percent}%`
    : `${streakInfo.trend_percent}%`;

  // Assemble the share card lines
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const lines = [
    `Git Racer ${weekLabel}`,
    "",
    `${totalWeekCommits} commits this week`,
    dailyCounts.map((count, i) => `${dayLabels[i]}:${count}`).join(" "),
  ];

  if (streakInfo.current_streak > 0) lines.push(`${streakInfo.current_streak}-day streak`);
  if (streakInfo.last_week > 0) lines.push(`${trendStr} vs last week`);

  const shareText = lines.join("\n");

  // Build a Twitter-friendly version (under 280 chars)
  const streakText = streakInfo.current_streak > 0
    ? ` with a ${streakInfo.current_streak}-day streak`
    : "";
  const tweet = `I made ${totalWeekCommits} commits this week${streakText}. Think you can keep up?\n\n${env.CLIENT_URL}`;

  return c.json({
    text: shareText,
    tweet,
    url: env.CLIENT_URL,
    week_label: weekLabel,
  });
});

/**
 * Builds a GitHub-style contribution graph from daily commit snapshots.
 *
 * Iterates day-by-day over the past year and assigns each day an intensity
 * level (0--4) based on its commit count relative to the user's personal
 * maximum. The thresholds (25%, 50%, 75%) mirror GitHub's own heatmap.
 *
 * @param days  - Sparse array of {date, count} rows from the DB (only days with commits)
 * @param now   - The current date, used as the end boundary
 * @returns An object with a dense array of ContributionDay entries and the year's total commits
 */
function buildContributionGraph(
  days: { date: string; count: number }[],
  now: Date
): { days: ContributionDay[]; total_year: number } {
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  yearAgo.setDate(yearAgo.getDate() + 1);

  // Index the sparse DB rows by date for O(1) lookup during iteration
  const countByDate = new Map(days.map((d) => [d.date, d.count]));
  // Floor of 1 prevents division-by-zero when the user has no commits
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const result: ContributionDay[] = [];
  let totalYear = 0;
  const cursor = new Date(yearAgo);

  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const count = countByDate.get(dateKey) ?? 0;
    totalYear += count;
    // Compute intensity level: 0 = no commits, 1--4 = quartile buckets
    const ratio = maxCount > 0 ? count / maxCount : 0;
    const level = count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    result.push({ date: dateKey, count, level });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { days: result, total_year: totalYear };
}
