import { Hono } from "hono";
import { db } from "../db/index.js";
import { commitSnapshots, suggestedOpponents, users } from "../db/schema.js";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";

export const leaderboardRoutes = new Hono();

function getPeriodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  switch (period) {
    case "day": {
      // Use yesterday since the cron fetches the previous day's data
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      return { start: yStr, end: yStr };
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

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
  const { start, end } = getPeriodRange(period);

  // Aggregate commit counts from DB
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

  // Enrich with avatar URLs — check suggested_opponents first, then users table
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [suggested] = await db
        .select({ avatar_url: suggestedOpponents.avatar_url })
        .from(suggestedOpponents)
        .where(eq(suggestedOpponents.github_username, row.github_username))
        .limit(1);

      if (suggested?.avatar_url) {
        return {
          github_username: row.github_username,
          avatar_url: suggested.avatar_url,
          commit_count: Number(row.total_commits),
        };
      }

      const [user] = await db
        .select({ avatar_url: users.avatar_url })
        .from(users)
        .where(eq(users.github_username, row.github_username))
        .limit(1);

      return {
        github_username: row.github_username,
        avatar_url: user?.avatar_url ?? `https://github.com/${row.github_username}.png`,
        commit_count: Number(row.total_commits),
      };
    })
  );

  return c.json(enriched);
});
