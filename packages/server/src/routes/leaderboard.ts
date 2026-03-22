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

  // Single query: aggregate commits + LEFT JOIN for avatars, filter bots
  const rows = await db.execute(sql`
    SELECT
      cs.github_username,
      COALESCE(SUM(cs.commit_count), 0)::int AS commit_count,
      COALESCE(so.avatar_url, u.avatar_url, 'https://github.com/' || cs.github_username || '.png') AS avatar_url
    FROM commit_snapshots cs
    LEFT JOIN suggested_opponents so ON so.github_username = cs.github_username
    LEFT JOIN users u ON u.github_username = cs.github_username
    WHERE cs.date >= ${start}
      AND cs.date <= ${end}
      AND cs.github_username NOT LIKE '%[bot]'
      AND cs.github_username NOT LIKE '%-bot'
      AND cs.github_username NOT IN ('dependabot', 'renovate', 'github-actions', 'greenkeeper', 'snyk-bot', 'codecov', 'imgbot', 'netlify', 'vercel')
    GROUP BY cs.github_username, so.avatar_url, u.avatar_url
    ORDER BY commit_count DESC
    LIMIT ${limit}
  `);

  return c.json(
    rows.rows.map((r: any) => ({
      github_username: r.github_username,
      avatar_url: r.avatar_url,
      commit_count: Number(r.commit_count),
    }))
  );
});
