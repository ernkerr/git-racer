import { db } from "../db/index.js";
import { famousDevs, commitSnapshots, userBenchmarks } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

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
 * Seed the famous_devs table from the curated list.
 */
export async function seedFamousDevs(): Promise<number> {
  let count = 0;
  const chunkSize = 10;

  for (let i = 0; i < FAMOUS_DEV_LIST.length; i += chunkSize) {
    const chunk = FAMOUS_DEV_LIST.slice(i, i + chunkSize);
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
    count += chunk.length;
  }

  return count;
}

/**
 * Get benchmark comparisons between a user and famous devs for a period.
 * Returns devs sorted by how close the matchup is (most interesting first).
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
  const { start, end } = getPeriodRange(period);

  // Get user's commits
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

  // Get all active famous devs
  const devs = await db
    .select()
    .from(famousDevs)
    .where(eq(famousDevs.active, true));

  // Get user's custom benchmarks
  const customDevs = await db
    .select()
    .from(userBenchmarks)
    .where(eq(userBenchmarks.user_id, userId));

  // Combine all dev usernames for commit lookup
  const allUsernames = [
    ...devs.map((d) => d.github_username),
    ...customDevs.map((d) => d.github_username),
  ];

  if (allUsernames.length === 0) return [];

  // Get their commits in bulk
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

  const commitMap = new Map(devCommits.map((r) => [r.github_username, Number(r.total)]));
  const customSet = new Set(customDevs.map((d) => d.github_username));

  // Build results from famous devs
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

  // Add custom devs (that aren't already in famous devs)
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

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  switch (period) {
    case "week": {
      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);
      return { start: monday.toISOString().slice(0, 10), end };
    }
    case "month": {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { start: monthStart, end };
    }
    case "yearly":
    default:
      return { start: `${now.getFullYear()}-01-01`, end };
  }
}
