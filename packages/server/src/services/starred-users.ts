import { db } from "../db/index.js";
import { userBenchmarks, commitSnapshots, eventCommitters } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { periodRange, today } from "../lib/dates.js";

/**
 * Get comparisons between the user and their starred developers.
 */
export async function getStarredComparisons(
  username: string,
  userId: number,
  period: "week" | "month" | "yearly"
): Promise<{
  github_username: string;
  display_name: string;
  avatar_url: string | null;
  their_commits: number;
  your_commits: number;
  you_beat_them: boolean;
}[]> {
  const { start, end } = periodRange(period);

  // Get user's starred devs
  const starred = await db
    .select()
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  if (starred.length === 0) return [];

  const allUsernames = [username, ...starred.map((s) => s.github_username)];

  // Try event_committers first (GH Archive / real-time data)
  const eventCounts = await db.execute(sql`
    SELECT
      github_username,
      COALESCE(SUM(commit_count), 0)::int AS total
    FROM event_committers
    WHERE github_username IN (${sql.join(allUsernames.map((u) => sql`${u}`), sql`, `)})
      AND date >= ${start}
      AND date <= ${end}
    GROUP BY github_username
  `);

  let commitMap = new Map(
    (eventCounts.rows as any[]).map((r) => [r.github_username, Number(r.total)])
  );

  // Fall back to commit_snapshots if no event data
  if (commitMap.size === 0) {
    const snapCounts = await db
      .select({
        github_username: commitSnapshots.github_username,
        total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
      })
      .from(commitSnapshots)
      .where(
        and(
          gte(commitSnapshots.date, start),
          lte(commitSnapshots.date, end),
          sql`${commitSnapshots.github_username} IN (${sql.join(
            allUsernames.map((u) => sql`${u}`),
            sql`, `
          )})`
        )
      )
      .groupBy(commitSnapshots.github_username);

    commitMap = new Map(snapCounts.map((r) => [r.github_username, Number(r.total)]));
  }

  const yourCommits = commitMap.get(username) ?? 0;

  return starred.map((s) => {
    const theirCommits = commitMap.get(s.github_username) ?? 0;
    return {
      github_username: s.github_username,
      display_name: s.display_name ?? s.github_username,
      avatar_url: `https://github.com/${s.github_username}.png`,
      their_commits: theirCommits,
      your_commits: yourCommits,
      you_beat_them: yourCommits > theirCommits,
    };
  });
}

/**
 * Get suggested users to star based on leaderboard activity.
 */
export async function getStarSuggestions(
  userId: number,
  limit: number = 5
): Promise<{ github_username: string; avatar_url: string | null; commit_count: number }[]> {
  // Get already-starred usernames
  const starred = await db
    .select({ github_username: userBenchmarks.github_username })
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  const starredSet = new Set(starred.map((s) => s.github_username));

  // Get top active users from event_committers (most recent day with data)
  const rows = await db.execute(sql`
    SELECT
      github_username,
      avatar_url,
      commit_count
    FROM event_committers
    WHERE date = (SELECT MAX(date) FROM event_committers)
      AND github_username NOT LIKE '%[bot]'
      AND github_username NOT LIKE '%-bot'
      AND github_username NOT IN ('dependabot', 'renovate', 'github-actions', 'greenkeeper', 'snyk-bot', 'codecov', 'imgbot', 'netlify', 'vercel', 'Copilot', 'github-merge-queue')
    ORDER BY commit_count DESC
    LIMIT ${limit + starredSet.size + 10}
  `);

  return (rows.rows as any[])
    .filter((r) => !starredSet.has(r.github_username))
    .slice(0, limit)
    .map((r) => ({
      github_username: r.github_username,
      avatar_url: r.avatar_url,
      commit_count: Number(r.commit_count),
    }));
}
