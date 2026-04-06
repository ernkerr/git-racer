/**
 * Famous developers benchmark service.
 *
 * Maintains a curated list of well-known open-source developers and provides
 * commit-count comparisons between the current user and those developers.
 * Users can also add their own custom benchmarks (stored in `user_benchmarks`),
 * which are merged into the results alongside the curated list.
 */
import { db } from "../db/index.js";
import { famousDevs, commitSnapshots, userBenchmarks } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";
import { refreshCommitData } from "./commits.js";

/**
 * Curated list of notable open-source developers.
 * These are well-known enough that beating them is meaningful and shareable.
 */
export const FAMOUS_DEV_LIST = [
  // Legends
  { github_username: "torvalds", display_name: "Linus Torvalds", known_for: "Linux & Git creator", category: "legends" },
  { github_username: "dhh", display_name: "DHH", known_for: "Ruby on Rails creator", category: "legends" },

  // CEOs
  { github_username: "rauchg", display_name: "Guillermo Rauch", known_for: "Vercel CEO", category: "ceos" },
  { github_username: "garrytan", display_name: "Gary Tan", known_for: "Y Combinator President", category: "ceos" },
  { github_username: "hwchase17", display_name: "Harrison Chase", known_for: "LangChain CEO", category: "ceos" },

  // Indie Hackers
  { github_username: "levelsio", display_name: "Pieter Levels", known_for: "Nomad List, Photo AI", category: "indie-hackers" },
  { github_username: "sindresorhus", display_name: "Sindre Sorhus", known_for: "1000+ npm packages", category: "indie-hackers" },

  // Framework Builders
  { github_username: "taylorotwell", display_name: "Taylor Otwell", known_for: "Laravel creator", category: "framework-builders" },

  // Founders
  { github_username: "steipete", display_name: "Peter Steinberger", known_for: "PSPDFKit founder", category: "founders" },
] as const;

/**
 * Seed (or update) the `famous_devs` table from the in-code curated list.
 *
 * Uses an upsert so that re-running the seed is safe: existing rows get their
 * display_name, known_for, avatar_url, and category refreshed from the source
 * of truth without creating duplicates.
 *
 * @returns The number of rows upserted.
 */
export async function seedFamousDevs(): Promise<number> {
  let seededCount = 0;
  const chunkSize = 10;

  for (let i = 0; i < FAMOUS_DEV_LIST.length; i += chunkSize) {
    const chunk = FAMOUS_DEV_LIST.slice(i, i + chunkSize);
    // ON CONFLICT on github_username: overwrite mutable fields so the curated
    // list in code is always the source of truth for display metadata.
    await db
      .insert(famousDevs)
      .values(
        chunk.map((d) => ({
          github_username: d.github_username,
          display_name: d.display_name,
          known_for: d.known_for,
          avatar_url: `https://github.com/${d.github_username}.png`,
          category: d.category,
        }))
      )
      .onConflictDoUpdate({
        target: famousDevs.github_username,
        set: {
          display_name: sql`excluded.display_name`,
          known_for: sql`excluded.known_for`,
          avatar_url: sql`excluded.avatar_url`,
          category: sql`excluded.category`,
        },
      });
    seededCount += chunk.length;
  }

  return seededCount;
}

/**
 * Build benchmark comparisons between a user and all famous/custom developers
 * for a given time period.
 *
 * Strategy:
 * 1. Sum the authenticated user's commits from `commit_snapshots` for the period.
 * 2. Load all active famous devs + the user's custom benchmarks.
 * 3. Bulk-fetch commit totals for all those developers in one query.
 * 4. Merge results, marking each entry with whether the user beat them.
 *
 * @param username - GitHub login of the authenticated user.
 * @param userId   - Internal user ID (for looking up custom benchmarks).
 * @param period   - Time window: current week, month, or year.
 * @returns Array of comparison objects combining famous and custom developers.
 */
export async function getBenchmarks(
  username: string,
  userId: number,
  period: "week" | "month" | "yearly"
): Promise<{
  github_username: string;
  display_name: string;
  known_for: string;
  avatar_url: string | null;
  category: string;
  their_commits: number;
  your_commits: number;
  you_beat_them: boolean;
  is_custom: boolean;
}[]> {
  const { start, end } = periodRange(period);

  // Step 1: Sum the user's own commits for the period
  const [userRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`,
    })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, start),
        lte(commitSnapshots.date, end)
      )
    );
  const yourCommits = Number(userRow?.total ?? 0);

  // Step 2: Load all active famous devs from the curated table
  const devs = await db
    .select()
    .from(famousDevs)
    .where(eq(famousDevs.active, true));

  // Step 2b: Load any user-added custom benchmarks (rivals they picked themselves)
  const customDevs = await db
    .select()
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  // Combine both sets of usernames so we can fetch their commits in one query
  const allUsernames = [
    ...devs.map((d) => d.github_username),
    ...customDevs.map((d) => d.github_username),
  ];

  if (allUsernames.length === 0) return [];

  // Refresh commit data for all benchmark devs so numbers are current
  await Promise.all(
    allUsernames.map((u) => refreshCommitData(u).catch(() => {}))
  );

  // Step 3: Bulk-fetch commit totals for all benchmark developers in one query.
  // Uses a dynamic IN clause built from the combined username list.
  const devCommits = await db
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

  // Build a lookup map: username -> total commits for the period
  const commitMap = new Map(devCommits.map((r) => [r.github_username, Number(r.total)]));

  // Step 4: Assemble comparison results, starting with the curated famous devs
  const results = devs.map((dev) => {
    const theirCommits = commitMap.get(dev.github_username) ?? 0;
    return {
      github_username: dev.github_username,
      display_name: dev.display_name,
      known_for: dev.known_for,
      avatar_url: dev.avatar_url,
      category: dev.category ?? "other",
      their_commits: theirCommits,
      your_commits: yourCommits,
      you_beat_them: yourCommits > theirCommits,
      is_custom: false,
    };
  });

  // Append custom benchmark devs, skipping any that already appear in the famous list
  const famousSet = new Set(devs.map((d) => d.github_username));
  for (const custom of customDevs) {
    if (famousSet.has(custom.github_username)) continue;
    const theirCommits = commitMap.get(custom.github_username) ?? 0;
    results.push({
      github_username: custom.github_username,
      display_name: custom.display_name ?? custom.github_username,
      known_for: "Custom",
      avatar_url: `https://github.com/${custom.github_username}.png`,
      category: "your-picks",
      their_commits: theirCommits,
      your_commits: yourCommits,
      you_beat_them: yourCommits > theirCommits,
      is_custom: true,
    });
  }

  return results;
}

