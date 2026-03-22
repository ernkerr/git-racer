import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getUserStatsFast, refreshCommitData } from "../services/commits.js";
import { computeStreaks } from "../services/streaks.js";
import { today, weekStart, isoWeek } from "../lib/dates.js";
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

/**
 * Consolidated dashboard — stats, challenges, streaks, contributions in one call.
 */
meRoutes.get("/dashboard", async (c) => {
  const { sub: userId, username } = c.get("user");

  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  await refreshCommitData(username, user.access_token);

  const now = new Date();
  const todayStr = today();

  const [stats, challengeRows, streakInfo, contribDays] = await Promise.all([
    getUserStatsFast(username),
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

  const contributions = buildContributionGraph(contribDays, now);

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

  return c.json({ stats, challenges, streaks: streakInfo, contributions });
});

meRoutes.get("/share", async (c) => {
  const { username } = c.get("user");

  const now = new Date();
  const weekLabel = `W${isoWeek(now)} ${now.getFullYear()}`;
  const ws = weekStart();
  const t = today();

  const days = await db
    .select({ date: commitSnapshots.date, count: commitSnapshots.commit_count })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, ws),
        lte(commitSnapshots.date, t)
      )
    )
    .orderBy(commitSnapshots.date);

  const streakInfo = await computeStreaks(username);

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

  const totalWeek = days.reduce((s, d) => s + d.count, 0);
  const trendStr = streakInfo.trend_percent >= 0
    ? `+${streakInfo.trend_percent}%`
    : `${streakInfo.trend_percent}%`;

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const lines = [
    `Git Racer ${weekLabel}`,
    "",
    `${totalWeek} commits this week`,
    dailyCounts.map((c, i) => `${dayLabels[i]}:${c}`).join(" "),
  ];

  if (streakInfo.current_streak > 0) lines.push(`${streakInfo.current_streak}-day streak`);
  if (streakInfo.last_week > 0) lines.push(`${trendStr} vs last week`);

  return c.json({ text: lines.join("\n"), week_label: weekLabel });
});

function buildContributionGraph(
  days: { date: string; count: number }[],
  now: Date
): { days: ContributionDay[]; total_year: number } {
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  yearAgo.setDate(yearAgo.getDate() + 1);

  const dayMap = new Map(days.map((d) => [d.date, d.count]));
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const result: ContributionDay[] = [];
  let totalYear = 0;
  const cursor = new Date(yearAgo);

  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const count = dayMap.get(dateKey) ?? 0;
    totalYear += count;
    const ratio = maxCount > 0 ? count / maxCount : 0;
    const level = count === 0 ? 0 : ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
    result.push({ date: dateKey, count, level });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { days: result, total_year: totalYear };
}
