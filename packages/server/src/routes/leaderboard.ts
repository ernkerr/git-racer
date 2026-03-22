import { Hono } from "hono";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";

export const leaderboardRoutes = new Hono();

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
  const { start, end } = periodRange(period);

  // For the "day" period, use the most recent date in event_committers
  // since today's data may not be fully ingested yet.
  // For other periods, use the full date range.
  const eventRows = await db.execute(sql`
    SELECT
      ec.github_username,
      COALESCE(SUM(ec.commit_count), 0)::int AS commit_count,
      (array_agg(ec.avatar_url ORDER BY ec.last_seen_at DESC))[1] AS avatar_url
    FROM event_committers ec
    WHERE ec.date >= ${start}
      AND ec.date <= ${end}
    GROUP BY ec.github_username
    ORDER BY commit_count DESC
    LIMIT ${limit}
  `);

  // If no event data for this range, try the most recent day available
  if (eventRows.rows.length === 0 && period === "day") {
    const recentRows = await db.execute(sql`
      SELECT
        ec.github_username,
        ec.commit_count,
        ec.avatar_url
      FROM event_committers ec
      WHERE ec.date = (SELECT MAX(date) FROM event_committers)
      ORDER BY ec.commit_count DESC
      LIMIT ${limit}
    `);

    if (recentRows.rows.length > 0) {
      return c.json(
        recentRows.rows.map((r: any) => ({
          github_username: r.github_username,
          avatar_url: r.avatar_url,
          commit_count: Number(r.commit_count),
        }))
      );
    }
  }

  if (eventRows.rows.length > 0) {
    return c.json(
      eventRows.rows.map((r: any) => ({
        github_username: r.github_username,
        avatar_url: r.avatar_url,
        commit_count: Number(r.commit_count),
      }))
    );
  }

  // Fallback to commit_snapshots if no event data at all
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
