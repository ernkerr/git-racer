import { db } from "../db/index.js";
import { socialCircles, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { SOCIAL_CIRCLE_CACHE_MS } from "@git-racer/shared";
import type { SocialCircleData } from "@git-racer/shared";

/**
 * Fetch a user's GitHub following list and cache it.
 */
export async function fetchAndCacheFollowing(
  userId: number,
  username: string,
  token: string
): Promise<void> {
  // Fetch from GitHub
  const following: { login: string; avatar_url: string }[] = [];
  let page = 1;
  const maxPages = 5;

  while (page <= maxPages) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/following?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as { login: string; avatar_url: string }[];
    if (data.length === 0) break;

    following.push(...data);
    if (data.length < 100) break;
    page++;
  }

  if (following.length === 0) return;

  // Clear old cache and insert new
  await db.delete(socialCircles).where(eq(socialCircles.user_id, userId));

  const chunkSize = 50;
  for (let i = 0; i < following.length; i += chunkSize) {
    const chunk = following.slice(i, i + chunkSize);
    await db.insert(socialCircles).values(
      chunk.map((f) => ({
        user_id: userId,
        following_username: f.login,
        avatar_url: f.avatar_url,
      }))
    );
  }
}

/**
 * Get the user's rank among people they follow for the current week.
 * Always serves from cache. Triggers a background refresh if stale.
 */
export async function getSocialCircleRanking(
  userId: number,
  username: string,
  token: string
): Promise<SocialCircleData> {
  // Check cache age
  const [latest] = await db
    .select({ fetched_at: socialCircles.fetched_at })
    .from(socialCircles)
    .where(eq(socialCircles.user_id, userId))
    .orderBy(desc(socialCircles.fetched_at))
    .limit(1);

  const isStale = !latest || Date.now() - latest.fetched_at.getTime() >= SOCIAL_CIRCLE_CACHE_MS;

  // If stale, kick off background refresh (non-blocking)
  if (isStale) {
    fetchAndCacheFollowing(userId, username, token).catch(() => {});
  }

  // Always serve from cache
  const cached = await db
    .select({
      following_username: socialCircles.following_username,
      avatar_url: socialCircles.avatar_url,
    })
    .from(socialCircles)
    .where(eq(socialCircles.user_id, userId));

  const followingUsernames = cached.map((r) => r.following_username);

  if (followingUsernames.length === 0) {
    return { entries: [], your_rank: 0, total: 0 };
  }

  // Get this week's date range
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekStart = monday.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // Get commits for all following + the user themselves
  const allUsernames = [...followingUsernames, username];
  const commits = await db
    .select({
      github_username: commitSnapshots.github_username,
      total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
    })
    .from(commitSnapshots)
    .where(
      and(
        gte(commitSnapshots.date, weekStart),
        lte(commitSnapshots.date, todayStr),
        sql`${commitSnapshots.github_username} IN (${sql.join(
          allUsernames.map((u) => sql`${u}`),
          sql`, `
        )})`
      )
    )
    .groupBy(commitSnapshots.github_username);

  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));
  const avatarMap = new Map(cached.map((r) => [r.following_username, r.avatar_url]));

  const entries = allUsernames.map((u) => ({
    github_username: u,
    avatar_url: avatarMap.get(u) ?? `https://github.com/${u}.png`,
    commit_count: commitMap.get(u) ?? 0,
    is_you: u === username,
  }));

  entries.sort((a, b) => b.commit_count - a.commit_count);

  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const yourRank = ranked.find((e) => e.is_you)?.rank ?? 0;

  return {
    entries: ranked.slice(0, 50),
    your_rank: yourRank,
    total: ranked.length,
  };
}
