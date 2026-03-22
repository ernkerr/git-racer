/**
 * Starred-users comparison service.
 * Lets users "star" GitHub developers and compare commit activity against
 * them. Commit data is blended from two sources (commit_snapshots for app
 * users and event_committers from GH Archive) via a FULL OUTER JOIN to
 * maximize coverage.
 */
import { db } from "../db/index.js";
import { userBenchmarks, commitSnapshots, eventCommitters } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";

/**
 * Build commit-count comparisons between the authenticated user and every
 * developer they have starred.
 *
 * Commit data is blended from two independent sources (GH Archive and GraphQL
 * scrapes) using a FULL OUTER JOIN + GREATEST so we always show the most
 * complete count regardless of which pipeline has run.
 *
 * @param username - GitHub login of the authenticated user.
 * @param userId   - Internal user ID (for looking up their starred list).
 * @param period   - Time window: current week, month, or year.
 * @returns One entry per starred developer with commit totals and win/lose flag.
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

  // Load the list of developers this user has starred (their "rivals")
  const starred = await db
    .select()
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  if (starred.length === 0) return [];

  // Include the user themselves so we fetch their commits in the same query
  const allUsernames = [username, ...starred.map((s) => s.github_username)];

  // Blending query: we have two independent commit-count sources:
  //   - event_committers: populated from GH Archive (public push events)
  //   - commit_snapshots: populated from the GitHub GraphQL API for app users
  //
  // A FULL OUTER JOIN on github_username combines them so we get data even
  // if a user only exists in one source. GREATEST picks the higher total,
  // which avoids undercounting when one source has incomplete data.
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

  // Build a lookup map: username -> best-known commit total for the period
  const commitMap = new Map(
    (blended.rows as any[]).map((r) => [r.github_username, Number(r.total)])
  );

  const yourCommits = commitMap.get(username) ?? 0;

  // Map each starred developer into a comparison result
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
 * Curated list of notable developers shown as suggestions to new users who
 * haven't starred anyone yet. Ordered roughly by name recognition.
 */
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
 * Return a short list of suggested famous developers for the user to star.
 *
 * Filters out any developers the user has already starred so the suggestions
 * stay fresh. Returns at most `limit` entries (default 6).
 *
 * @param userId - Internal user ID used to look up existing stars.
 * @param limit  - Maximum number of suggestions to return.
 * @returns Suggestions with avatar URLs; commit_count is 0 (placeholder).
 */
export async function getStarSuggestions(
  userId: number,
  limit: number = 6
): Promise<{ github_username: string; avatar_url: string | null; commit_count: number }[]> {
  // Fetch the set of usernames the user has already starred
  const starred = await db
    .select({ github_username: userBenchmarks.github_username })
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  const alreadyStarredSet = new Set(starred.map((s) => s.github_username));

  // Filter out already-starred devs, then take the first `limit` entries
  return SUGGESTED_DEVS
    .filter((dev) => !alreadyStarredSet.has(dev.github_username))
    .slice(0, limit)
    .map((dev) => ({
      github_username: dev.github_username,
      avatar_url: `https://github.com/${dev.github_username}.png`,
      commit_count: 0,
    }));
}
