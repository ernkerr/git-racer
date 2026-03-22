/**
 * Social-circle ranking service.
 * Fetches the authenticated user's GitHub "following" list, caches it
 * locally, and ranks everyone (including the user) by weekly commit count
 * so the user can see where they stand among the people they follow.
 */
import { db } from "../db/index.js";
import { socialCircles, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { SOCIAL_CIRCLE_CACHE_MS } from "@git-racer/shared";
import type { SocialCircleData } from "@git-racer/shared";
import { today, weekStart } from "../lib/dates.js";

/**
 * Fetch the full "following" list for a GitHub user and replace the local cache.
 *
 * Paginates through the GitHub REST API (up to 5 pages / 500 users) and
 * performs a delete-then-insert to refresh the `social_circles` table.
 * This is designed to run in the background so it does not block the ranking
 * endpoint.
 *
 * @param userId   - Internal user ID that owns this social circle cache.
 * @param username - GitHub login used to call the following API.
 * @param token    - OAuth token for authenticated GitHub API requests.
 */
export async function fetchAndCacheFollowing(
  userId: number,
  username: string,
  token: string
): Promise<void> {
  const following: { login: string; avatar_url: string }[] = [];
  let page = 1;
  // Cap at 5 pages (500 users) to avoid excessive API calls
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
    // A partial page means we've reached the end of the list
    if (data.length < 100) break;
    page++;
  }

  if (following.length === 0) return;

  // Replace the entire cache: delete old rows, then bulk-insert the fresh list.
  // This is simpler than diffing and handles unfollows correctly.
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
 * Compute the user's weekly commit rank among the people they follow on GitHub.
 *
 * Always serves from the local cache for fast responses. If the cache is stale
 * (older than SOCIAL_CIRCLE_CACHE_MS), a non-blocking background refresh is
 * kicked off so the next call will have fresher data.
 *
 * @param userId   - Internal user ID for cache lookup.
 * @param username - GitHub login of the authenticated user (included in ranking).
 * @param token    - OAuth token passed through to the background refresh if needed.
 * @returns Ranked leaderboard entries (top 50), the user's rank, and total count.
 */
export async function getSocialCircleRanking(
  userId: number,
  username: string,
  token: string
): Promise<SocialCircleData> {
  // Determine cache freshness by checking the most recent fetched_at timestamp
  const [latest] = await db
    .select({ fetched_at: socialCircles.fetched_at })
    .from(socialCircles)
    .where(eq(socialCircles.user_id, userId))
    .orderBy(desc(socialCircles.fetched_at))
    .limit(1);

  const isStale = !latest || Date.now() - latest.fetched_at.getTime() >= SOCIAL_CIRCLE_CACHE_MS;

  // If stale, kick off a background refresh. The .catch() ensures the
  // fire-and-forget promise doesn't cause unhandled rejection warnings.
  if (isStale) {
    fetchAndCacheFollowing(userId, username, token).catch(() => {});
  }

  // Always serve from the current cache (even if a refresh is in flight)
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

  const currentWeekStart = weekStart();
  const currentDay = today();

  // Include the user in the username list so they appear in their own leaderboard
  const allUsernames = [...followingUsernames, username];

  // Bulk-fetch weekly commit totals for the user + all their followed accounts.
  // Uses a dynamic IN clause built from the combined username list.
  const commits = await db
    .select({
      github_username: commitSnapshots.github_username,
      total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
    })
    .from(commitSnapshots)
    .where(
      and(
        gte(commitSnapshots.date, currentWeekStart),
        lte(commitSnapshots.date, currentDay),
        sql`${commitSnapshots.github_username} IN (${sql.join(
          allUsernames.map((u) => sql`${u}`),
          sql`, `
        )})`
      )
    )
    .groupBy(commitSnapshots.github_username);

  // Build lookup maps for O(1) access when assembling the leaderboard
  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));
  const avatarMap = new Map(cached.map((r) => [r.following_username, r.avatar_url]));

  // Assemble one entry per username with their commit total and avatar
  const entries = allUsernames.map((u) => ({
    github_username: u,
    avatar_url: avatarMap.get(u) ?? `https://github.com/${u}.png`,
    commit_count: commitMap.get(u) ?? 0,
    is_you: u === username,
  }));

  // Sort descending by commits to produce the leaderboard order
  entries.sort((a, b) => b.commit_count - a.commit_count);

  // Assign 1-based ranks and find the user's position
  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const yourRank = ranked.find((e) => e.is_you)?.rank ?? 0;

  return {
    entries: ranked.slice(0, 50), // Cap at top 50 to keep payloads small
    your_rank: yourRank,
    total: ranked.length,
  };
}
