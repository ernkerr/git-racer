import { db } from "../db/index.js";
import { userBenchmarks, commitSnapshots, eventCommitters } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";

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

  // Blend both sources: use GREATEST of event_committers (GH Archive)
  // and commit_snapshots (real GraphQL data for app users)
  const blended = await db.execute(sql`
    SELECT
      github_username,
      GREATEST(COALESCE(ec_total, 0), COALESCE(cs_total, 0))::int AS total
    FROM (
      SELECT
        COALESCE(ec.github_username, cs.github_username) AS github_username,
        ec.total AS ec_total,
        cs.total AS cs_total
      FROM (
        SELECT github_username, SUM(commit_count)::int AS total
        FROM event_committers
        WHERE date >= ${start} AND date <= ${end}
          AND github_username IN (${sql.join(allUsernames.map((u) => sql`${u}`), sql`, `)})
        GROUP BY github_username
      ) ec
      FULL OUTER JOIN (
        SELECT github_username, SUM(commit_count)::int AS total
        FROM commit_snapshots
        WHERE date >= ${start} AND date <= ${end}
          AND github_username IN (${sql.join(allUsernames.map((u) => sql`${u}`), sql`, `)})
        GROUP BY github_username
      ) cs ON ec.github_username = cs.github_username
    ) merged
  `);

  const commitMap = new Map(
    (blended.rows as any[]).map((r) => [r.github_username, Number(r.total)])
  );

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

/** Notable developers to suggest for starring */
const SUGGESTED_DEVS = [
  { github_username: "torvalds", display: "Linus Torvalds" },
  { github_username: "steipete", display: "Peter Steinberger" },
  { github_username: "rauchg", display: "Guillermo Rauch" },
  { github_username: "dhh", display: "DHH" },
  { github_username: "levelsio", display: "Pieter Levels" },
  { github_username: "sindresorhus", display: "Sindre Sorhus" },
  { github_username: "taylorotwell", display: "Taylor Otwell" },
  { github_username: "hwchase17", display: "Harrison Chase" },
  { github_username: "garrytan", display: "Gary Tan" },
  { github_username: "karpathy", display: "Andrej Karpathy" },
  { github_username: "gaearon", display: "Dan Abramov" },
  { github_username: "tj", display: "TJ Holowaychuk" },
];

/**
 * Get suggested famous devs to star, excluding already-starred ones.
 */
export async function getStarSuggestions(
  userId: number,
  limit: number = 6
): Promise<{ github_username: string; avatar_url: string | null; commit_count: number }[]> {
  const starred = await db
    .select({ github_username: userBenchmarks.github_username })
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  const starredSet = new Set(starred.map((s) => s.github_username));

  return SUGGESTED_DEVS
    .filter((d) => !starredSet.has(d.github_username))
    .slice(0, limit)
    .map((d) => ({
      github_username: d.github_username,
      avatar_url: `https://github.com/${d.github_username}.png`,
      commit_count: 0,
    }));
}
