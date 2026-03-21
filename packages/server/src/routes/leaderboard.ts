import { Hono } from "hono";
import { fetchTopGitHubUsers, fetchBatchContributions } from "../services/github.js";

export const leaderboardRoutes = new Hono();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface LeaderboardEntry {
  github_username: string;
  avatar_url: string;
  commit_count: number;
}

let topUsersCache: CacheEntry<{ login: string; avatar_url: string }[]> | null = null;
const leaderboardCache = new Map<string, CacheEntry<LeaderboardEntry[]>>();

const TOP_USERS_TTL = 24 * 60 * 60 * 1000; // 24 hours
const LEADERBOARD_TTL = 30 * 60 * 1000; // 30 minutes

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (period) {
    case "day": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end };
    }
    case "week": {
      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);
      monday.setHours(0, 0, 0, 0);
      return { start: monday, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case "all":
    default: {
      // GitHub API limits contributionsCollection to ~1 year, so use current year
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end };
    }
  }
}

async function getTopUsers(): Promise<{ login: string; avatar_url: string }[]> {
  if (topUsersCache && Date.now() - topUsersCache.timestamp < TOP_USERS_TTL) {
    return topUsersCache.data;
  }

  const users = await fetchTopGitHubUsers(150);
  topUsersCache = { data: users, timestamp: Date.now() };
  return users;
}

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);

  // Check cache
  const cached = leaderboardCache.get(period);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_TTL) {
    return c.json(cached.data.slice(0, limit));
  }

  const { start, end } = getPeriodDates(period);

  // Get pool of top GitHub users
  const topUsers = await getTopUsers();
  const usernames = topUsers.map((u) => u.login);

  // Batch fetch contributions for the period
  const contributions = await fetchBatchContributions(usernames, start, end);

  // Build leaderboard sorted by contributions
  const avatarMap = new Map(topUsers.map((u) => [u.login, u.avatar_url]));
  const leaderboard: LeaderboardEntry[] = Object.entries(contributions)
    .map(([username, count]) => ({
      github_username: username,
      avatar_url: avatarMap.get(username) || `https://github.com/${username}.png`,
      commit_count: count,
    }))
    .filter((e) => e.commit_count > 0)
    .sort((a, b) => b.commit_count - a.commit_count);

  // Cache results
  leaderboardCache.set(period, { data: leaderboard, timestamp: Date.now() });

  return c.json(leaderboard.slice(0, limit));
});
