import { db } from "../db/index.js";
import { famousDevs, commitSnapshots } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

/**
 * Curated list of notable open-source developers.
 * These are well-known enough that beating them is meaningful and shareable.
 */
export const FAMOUS_DEV_LIST = [
  // JavaScript / TypeScript ecosystem
  { github_username: "sindresorhus", display_name: "Sindre Sorhus", known_for: "1000+ npm packages", category: "open-source" },
  { github_username: "gaearon", display_name: "Dan Abramov", known_for: "React core team", category: "framework-authors" },
  { github_username: "tj", display_name: "TJ Holowaychuk", known_for: "Express.js creator", category: "framework-authors" },
  { github_username: "yyx990803", display_name: "Evan You", known_for: "Vue.js creator", category: "framework-authors" },
  { github_username: "timneutkens", display_name: "Tim Neutkens", known_for: "Next.js lead", category: "framework-authors" },
  { github_username: "kentcdodds", display_name: "Kent C. Dodds", known_for: "Testing Library creator", category: "educators" },
  { github_username: "antfu", display_name: "Anthony Fu", known_for: "Vite / Vue core team", category: "open-source" },
  { github_username: "Rich-Harris", display_name: "Rich Harris", known_for: "Svelte creator", category: "framework-authors" },
  { github_username: "rauchg", display_name: "Guillermo Rauch", known_for: "Vercel CEO, Socket.io", category: "founders" },
  { github_username: "colinhacks", display_name: "Colin McDonnell", known_for: "Zod creator", category: "open-source" },

  // Systems / Infrastructure
  { github_username: "torvalds", display_name: "Linus Torvalds", known_for: "Linux & Git creator", category: "legends" },
  { github_username: "antirez", display_name: "Salvatore Sanfilippo", known_for: "Redis creator", category: "legends" },
  { github_username: "mitchellh", display_name: "Mitchell Hashimoto", known_for: "HashiCorp founder", category: "founders" },
  { github_username: "FiloSottile", display_name: "Filippo Valsorda", known_for: "Go security team", category: "open-source" },
  { github_username: "BurntSushi", display_name: "Andrew Gallant", known_for: "ripgrep creator", category: "open-source" },

  // Python / ML
  { github_username: "guido", display_name: "Guido van Rossum", known_for: "Python creator", category: "legends" },
  { github_username: "tiangolo", display_name: "Sebastián Ramírez", known_for: "FastAPI creator", category: "framework-authors" },
  { github_username: "karpathy", display_name: "Andrej Karpathy", known_for: "AI researcher, Tesla", category: "ai" },

  // Rust
  { github_username: "dtolnay", display_name: "David Tolnay", known_for: "Rust serde/syn author", category: "open-source" },
  { github_username: "matklad", display_name: "Alex Kladov", known_for: "rust-analyzer creator", category: "open-source" },

  // DevTools / Community
  { github_username: "sharkdp", display_name: "David Peter", known_for: "bat, fd, hyperfine", category: "open-source" },
  { github_username: "jessfraz", display_name: "Jess Frazelle", known_for: "Docker / containers", category: "open-source" },
  { github_username: "ThePrimeagen", display_name: "ThePrimeagen", known_for: "Developer content creator", category: "educators" },
  { github_username: "cassidoo", display_name: "Cassidy Williams", known_for: "Developer advocate", category: "educators" },
  { github_username: "wesbos", display_name: "Wes Bos", known_for: "JavaScript educator", category: "educators" },

  // Go
  { github_username: "bradfitz", display_name: "Brad Fitzpatrick", known_for: "Go team, LiveJournal", category: "legends" },
  { github_username: "rsc", display_name: "Russ Cox", known_for: "Go language lead", category: "open-source" },

  // Founders / Leaders
  { github_username: "maboroshi", display_name: "Maboroshi", known_for: "Open source contributor", category: "open-source" },
  { github_username: "mojombo", display_name: "Tom Preston-Werner", known_for: "GitHub co-founder", category: "founders" },
  { github_username: "natfriedman", display_name: "Nat Friedman", known_for: "Former GitHub CEO", category: "founders" },

  // Web Standards / CSS
  { github_username: "addyosmani", display_name: "Addy Osmani", known_for: "Chrome DevTools lead", category: "open-source" },
  { github_username: "paulirish", display_name: "Paul Irish", known_for: "Chrome DevTools, Lighthouse", category: "open-source" },

  // More prolific contributors
  { github_username: "developit", display_name: "Jason Miller", known_for: "Preact creator", category: "framework-authors" },
  { github_username: "mrdoob", display_name: "Ricardo Cabello", known_for: "Three.js creator", category: "open-source" },
  { github_username: "isaacs", display_name: "Isaac Z. Schlueter", known_for: "npm creator", category: "founders" },
  { github_username: "brendangregg", display_name: "Brendan Gregg", known_for: "Performance engineering", category: "legends" },
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
  period: "week" | "month" | "yearly"
): Promise<{
  github_username: string;
  display_name: string;
  known_for: string;
  avatar_url: string | null;
  their_commits: number;
  your_commits: number;
  you_beat_them: boolean;
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

  if (devs.length === 0) return [];

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
          devs.map((d) => sql`${d.github_username}`),
          sql`, `
        )})`
      )
    )
    .groupBy(commitSnapshots.github_username);

  const commitMap = new Map(devCommits.map((r) => [r.github_username, Number(r.total)]));

  // Build results
  const results = devs.map((dev) => {
    const theirCommits = commitMap.get(dev.github_username) ?? 0;
    return {
      github_username: dev.github_username,
      display_name: dev.display_name,
      known_for: dev.known_for,
      avatar_url: dev.avatar_url,
      their_commits: theirCommits,
      your_commits: yourCommits,
      you_beat_them: yourCommits > theirCommits,
    };
  });

  // Sort: show devs you beat first, then by closest matchup
  results.sort((a, b) => {
    // Prioritize devs you beat (or are close to beating)
    const aDiff = a.your_commits - a.their_commits;
    const bDiff = b.your_commits - b.their_commits;

    // You beat them — show the most impressive wins first (highest their_commits)
    if (aDiff > 0 && bDiff > 0) return b.their_commits - a.their_commits;
    if (aDiff > 0) return -1;
    if (bDiff > 0) return 1;

    // You haven't beat them — show the closest ones first
    return bDiff - aDiff;
  });

  // Filter out devs with 0 commits (inactive this period) — keep max 20
  return results
    .filter((r) => r.their_commits > 0 || r.you_beat_them)
    .slice(0, 20);
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
