import { Hono } from "hono";
import { db } from "../db/index.js";
import { commitSnapshots, users } from "../db/schema.js";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";
import { fetchTopGitHubUsers, fetchBatchContributionDays } from "../services/github.js";

export const leaderboardRoutes = new Hono();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache for top users pool (24h)
let topUsersCache: CacheEntry<{ login: string; avatar_url: string }[]> | null = null;
const TOP_USERS_TTL = 24 * 60 * 60 * 1000;

// Cooldowns per period to avoid re-seeding too frequently
const seedTimestamps = new Map<string, number>();
const SEED_COOLDOWNS: Record<string, number> = {
  day: 60 * 60 * 1000,       // 1 hour
  week: 4 * 60 * 60 * 1000,  // 4 hours
  month: 12 * 60 * 60 * 1000, // 12 hours
  yearly: 24 * 60 * 60 * 1000, // 24 hours
};

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  switch (period) {
    case "day": {
      return { start: end, end };
    }
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
    default: {
      return { start: `${now.getFullYear()}-01-01`, end };
    }
  }
}

async function getTopUsers(): Promise<{ login: string; avatar_url: string }[]> {
  if (topUsersCache && Date.now() - topUsersCache.timestamp < TOP_USERS_TTL) {
    return topUsersCache.data;
  }

  const fetched = await fetchTopGitHubUsers(150);
  topUsersCache = { data: fetched, timestamp: Date.now() };
  return fetched;
}

/**
 * Seed contribution data for a period. Fetches day-by-day data from GitHub
 * and stores it in commitSnapshots. Respects cooldowns and rate limits.
 */
async function seedPeriodData(
  period: string,
  topUsers: { login: string; avatar_url: string }[]
): Promise<void> {
  const cooldown = SEED_COOLDOWNS[period] ?? SEED_COOLDOWNS.yearly;
  const lastSeeded = seedTimestamps.get(period) ?? 0;
  if (Date.now() - lastSeeded < cooldown) return;

  const { start, end } = getPeriodRange(period);
  const startDate = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T23:59:59Z");

  const usernames = topUsers.map((u) => u.login);

  // Fetch contribution days (sequential batches, stops on rate limit)
  const contributionData = await fetchBatchContributionDays(usernames, startDate, endDate);

  // Collect rows to upsert
  const rows: { github_username: string; date: string; commit_count: number }[] = [];
  for (const [username, days] of contributionData) {
    for (const day of days) {
      if (day.date >= start && day.date <= end) {
        rows.push({
          github_username: username,
          date: day.date,
          commit_count: day.count,
        });
      }
    }
  }

  // Batch upsert into commitSnapshots
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db
      .insert(commitSnapshots)
      .values(chunk)
      .onConflictDoUpdate({
        target: [commitSnapshots.github_username, commitSnapshots.date],
        set: {
          commit_count: sql`excluded.commit_count`,
          fetched_at: sql`now()`,
        },
      });
  }

  seedTimestamps.set(period, Date.now());
}

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
  const { start, end } = getPeriodRange(period);

  // Get top users pool
  const topUsers = await getTopUsers();

  // Seed data for this period (bounded, with cooldown)
  try {
    await seedPeriodData(period, topUsers);
  } catch (e) {
    console.error("Leaderboard seed error:", e);
  }

  // Query leaderboard from DB
  const rows = await db
    .select({
      github_username: commitSnapshots.github_username,
      total_commits: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total_commits"),
    })
    .from(commitSnapshots)
    .where(
      and(
        gte(commitSnapshots.date, start),
        lte(commitSnapshots.date, end)
      )
    )
    .groupBy(commitSnapshots.github_username)
    .orderBy(desc(sql`total_commits`))
    .limit(limit);

  // Enrich with avatar URLs
  const avatarMap = new Map(topUsers.map((u) => [u.login, u.avatar_url]));
  const enriched = await Promise.all(
    rows.map(async (row) => {
      let avatarUrl = avatarMap.get(row.github_username);
      if (!avatarUrl) {
        const [user] = await db
          .select({ avatar_url: users.avatar_url })
          .from(users)
          .where(eq(users.github_username, row.github_username))
          .limit(1);
        avatarUrl = user?.avatar_url ?? `https://github.com/${row.github_username}.png`;
      }

      return {
        github_username: row.github_username,
        avatar_url: avatarUrl,
        commit_count: Number(row.total_commits),
      };
    })
  );

  return c.json(enriched);
});
