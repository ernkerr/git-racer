import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { getUserStats, getUserStatsFast, refreshCommitData } from "../services/commits.js";
import { computeStreaks } from "../services/streaks.js";
import type { AppEnv } from "../types.js";
import type { ContributionDay } from "@git-racer/shared";

export const meRoutes = new Hono<AppEnv>();

meRoutes.use("*", requireAuth);

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

meRoutes.get("/stats", async (c) => {
  const { sub: userId } = c.get("user");

  const [user] = await db
    .select({
      github_username: users.github_username,
      access_token: users.access_token,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  const stats = await getUserStats(user.github_username, user.access_token);
  return c.json(stats);
});

meRoutes.get("/challenges", async (c) => {
  const { username } = c.get("user");
  const todayStr = new Date().toISOString().slice(0, 10);

  // Single query: get all user's challenges with participant counts and commit leaders
  const challengeRows = await db.execute(sql`
    WITH user_challenges AS (
      SELECT c.id, c.name, c.type, c.share_slug, c.end_date, c.start_date, c.created_at
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
        AND cs.date >= uc.start_date::date::text
        AND cs.date <= COALESCE(uc.end_date::date::text, ${todayStr})
      GROUP BY cp.challenge_id, cp.github_username
    )
    SELECT
      uc.id,
      uc.name,
      uc.type,
      uc.share_slug,
      uc.end_date,
      (SELECT COUNT(*)::int FROM challenge_participants cp2 WHERE cp2.challenge_id = uc.id) AS participant_count,
      COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id AND pc.github_username = ${username}), 0) AS your_commits,
      COALESCE((SELECT github_username FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), '') AS leader_username,
      COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), 0) AS leader_commits
    FROM user_challenges uc
    ORDER BY uc.created_at DESC
  `);

  return c.json(
    challengeRows.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      share_slug: r.share_slug,
      end_date: r.end_date?.toISOString?.() ?? r.end_date ?? null,
      your_commits: Number(r.your_commits),
      leader_username: r.leader_username,
      leader_commits: Number(r.leader_commits),
      participant_count: Number(r.participant_count),
    }))
  );
});

meRoutes.get("/streaks", async (c) => {
  const { sub: userId, username } = c.get("user");
  const streakInfo = await computeStreaks(username, userId);
  return c.json(streakInfo);
});

meRoutes.get("/contributions", async (c) => {
  const { sub: userId, username } = c.get("user");

  // Get user's token to refresh if needed
  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  // Ensure data is fresh
  await refreshCommitData(username, user.access_token);

  // Get the last 365 days of contribution data
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  yearAgo.setDate(yearAgo.getDate() + 1);

  const startDate = yearAgo.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const days = await db
    .select({
      date: commitSnapshots.date,
      count: commitSnapshots.commit_count,
    })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, startDate),
        lte(commitSnapshots.date, endDate)
      )
    )
    .orderBy(commitSnapshots.date);

  // Fill in missing days and compute levels
  const dayMap = new Map(days.map((d) => [d.date, d.count]));
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const result: ContributionDay[] = [];
  let totalYear = 0;
  const cursor = new Date(yearAgo);

  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const count = dayMap.get(dateKey) ?? 0;
    totalYear += count;

    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio > 0.75) level = 4;
      else if (ratio > 0.5) level = 3;
      else if (ratio > 0.25) level = 2;
      else level = 1;
    }

    result.push({ date: dateKey, count, level });
    cursor.setDate(cursor.getDate() + 1);
  }

  return c.json({ days: result, total_year: totalYear });
});

/**
 * Consolidated dashboard endpoint — returns stats, challenges, streaks,
 * and contributions in a single request instead of 4 separate ones.
 */
meRoutes.get("/dashboard", async (c) => {
  const { sub: userId, username } = c.get("user");

  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  // Refresh commit data once — shared by stats + contributions (no double refresh)
  await refreshCommitData(username, user.access_token);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Run all queries in parallel — getUserStatsFast skips all-time refresh
  const [stats, challengeRows, streakInfo, contribDays] = await Promise.all([
    getUserStatsFast(username),
    // Challenges — single SQL query
    db.execute(sql`
      WITH user_challenges AS (
        SELECT c.id, c.name, c.type, c.share_slug, c.end_date, c.start_date, c.created_at
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
          AND cs.date >= uc.start_date::date::text
          AND cs.date <= COALESCE(uc.end_date::date::text, ${todayStr})
        GROUP BY cp.challenge_id, cp.github_username
      )
      SELECT
        uc.id,
        uc.name,
        uc.type,
        uc.share_slug,
        uc.end_date,
        (SELECT COUNT(*)::int FROM challenge_participants cp2 WHERE cp2.challenge_id = uc.id) AS participant_count,
        COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id AND pc.github_username = ${username}), 0) AS your_commits,
        COALESCE((SELECT github_username FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), '') AS leader_username,
        COALESCE((SELECT commits FROM participant_commits pc WHERE pc.challenge_id = uc.id ORDER BY commits DESC LIMIT 1), 0) AS leader_commits
      FROM user_challenges uc
      ORDER BY uc.created_at DESC
    `),
    computeStreaks(username, userId),
    // Contributions — 365 days
    (() => {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      yearAgo.setDate(yearAgo.getDate() + 1);
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
    })(),
  ]);

  // Build contributions graph
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  yearAgo.setDate(yearAgo.getDate() + 1);
  const dayMap = new Map(contribDays.map((d) => [d.date, d.count]));
  const maxCount = Math.max(1, ...contribDays.map((d) => d.count));
  const contributionDays: ContributionDay[] = [];
  let totalYear = 0;
  const cursor = new Date(yearAgo);
  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const count = dayMap.get(dateKey) ?? 0;
    totalYear += count;
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio > 0.75) level = 4;
      else if (ratio > 0.5) level = 3;
      else if (ratio > 0.25) level = 2;
      else level = 1;
    }
    contributionDays.push({ date: dateKey, count, level });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Format challenges
  const challenges = challengeRows.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    share_slug: r.share_slug,
    end_date: r.end_date?.toISOString?.() ?? r.end_date ?? null,
    your_commits: Number(r.your_commits),
    leader_username: r.leader_username,
    leader_commits: Number(r.leader_commits),
    participant_count: Number(r.participant_count),
  }));

  return c.json({
    stats,
    challenges,
    streaks: streakInfo,
    contributions: { days: contributionDays, total_year: totalYear },
  });
});

meRoutes.get("/share", async (c) => {
  const { username } = c.get("user");

  const now = new Date();
  const weekNum = getISOWeek(now);
  const weekLabel = `W${weekNum} ${now.getFullYear()}`;

  // Get this week's data
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekStart = monday.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const days = await db
    .select({
      date: commitSnapshots.date,
      count: commitSnapshots.commit_count,
    })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, weekStart),
        lte(commitSnapshots.date, todayStr)
      )
    )
    .orderBy(commitSnapshots.date);

  const streakInfo = await computeStreaks(username);

  // Build activity bar for each day of the week so far
  const dailyCounts: number[] = [];
  const cursor = new Date(monday);
  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const dayData = days.find((d) => d.date === dateKey);
    dailyCounts.push(dayData?.count ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalWeek = days.reduce((s, d) => s + d.count, 0);
  const trendStr = streakInfo.trend_percent >= 0
    ? `+${streakInfo.trend_percent}%`
    : `${streakInfo.trend_percent}%`;

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const activityLine = dailyCounts
    .map((c, i) => `${dayLabels[i]}:${c}`)
    .join(" ");

  const lines = [
    `Git Racer ${weekLabel}`,
    "",
    `${totalWeek} contributions this week`,
    activityLine,
  ];

  if (streakInfo.current_streak > 0) {
    lines.push(`${streakInfo.current_streak}-day streak`);
  }
  if (streakInfo.last_week > 0) {
    lines.push(`${trendStr} vs last week`);
  }

  return c.json({ text: lines.join("\n"), week_label: weekLabel });
});

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
