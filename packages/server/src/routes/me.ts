import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users, challenges, challengeParticipants, commitSnapshots } from "../db/schema.js";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { getUserStats, getCommitCount, refreshCommitData } from "../services/commits.js";
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
  const { sub: userId, username } = c.get("user");

  // Get all challenges where the user is a participant
  const rows = await db
    .select({
      id: challenges.id,
      name: challenges.name,
      type: challenges.type,
      share_slug: challenges.share_slug,
      end_date: challenges.end_date,
      start_date: challenges.start_date,
    })
    .from(challenges)
    .innerJoin(
      challengeParticipants,
      eq(challenges.id, challengeParticipants.challenge_id)
    )
    .where(eq(challengeParticipants.github_username, username))
    .orderBy(desc(challenges.created_at));

  // For each challenge, get participant count and leader
  const result = await Promise.all(
    rows.map(async (challenge) => {
      const participants = await db
        .select({
          github_username: challengeParticipants.github_username,
        })
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challenge_id, challenge.id));

      // Get commit counts for each participant within the challenge period
      const startDate = challenge.start_date.toISOString().slice(0, 10);
      const endDate = challenge.end_date
        ? challenge.end_date.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const counts = await Promise.all(
        participants.map(async (p) => ({
          username: p.github_username,
          commits: await getCommitCount(p.github_username, startDate, endDate),
        }))
      );

      counts.sort((a, b) => b.commits - a.commits);
      const myCommits = counts.find((c) => c.username === username)?.commits ?? 0;

      return {
        id: challenge.id,
        name: challenge.name,
        type: challenge.type,
        share_slug: challenge.share_slug,
        end_date: challenge.end_date?.toISOString() ?? null,
        your_commits: myCommits,
        leader_username: counts[0]?.username ?? "",
        leader_commits: counts[0]?.commits ?? 0,
        participant_count: participants.length,
      };
    })
  );

  return c.json(result);
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

  // Build squares for each day of the week so far
  const squares = [];
  const cursor = new Date(monday);
  while (cursor <= now) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const dayData = days.find((d) => d.date === dateKey);
    const count = dayData?.count ?? 0;
    squares.push(count > 0 ? "\u{1f7e9}" : "\u2b1b"); // green or black square
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalWeek = days.reduce((s, d) => s + d.count, 0);
  const trendStr = streakInfo.trend_percent >= 0
    ? `+${streakInfo.trend_percent}%`
    : `${streakInfo.trend_percent}%`;

  const lines = [
    `Git Racer ${weekLabel}`,
    "",
    `${squares.join("")}  ${totalWeek} contributions`,
  ];

  if (streakInfo.current_streak > 0) {
    lines.push(`\u{1f525} ${streakInfo.current_streak}-day streak`);
  }
  if (streakInfo.last_week > 0) {
    lines.push(`\u{1f4c8} ${trendStr} vs last week`);
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
