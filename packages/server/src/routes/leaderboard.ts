import { Hono } from "hono";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";

export const leaderboardRoutes = new Hono();

const BOT_FILTER = sql`
  AND github_username NOT LIKE '%[bot]'
  AND github_username NOT LIKE '%-bot'
  AND github_username NOT IN ('dependabot', 'renovate', 'github-actions', 'greenkeeper', 'snyk-bot', 'codecov', 'imgbot', 'netlify', 'vercel', 'Copilot', 'github-merge-queue')
`;

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
  let { start, end } = periodRange(period);

  // For "day" period, if no data for today, use most recent day available
  if (period === "day") {
    const hasData = await db.execute(sql`
      SELECT 1 FROM event_committers WHERE date >= ${start} AND date <= ${end} LIMIT 1
    `);
    if (hasData.rows.length === 0) {
      const maxDate = await db.execute(sql`
        SELECT MAX(date) AS d FROM event_committers
      `);
      if (maxDate.rows.length > 0 && maxDate.rows[0].d) {
        start = maxDate.rows[0].d as string;
        end = start;
      }
    }
  }

  // Blend both data sources:
  // - event_committers: GH Archive public push data (everyone)
  // - commit_snapshots: real commit data from GraphQL (app users only)
  // Use GREATEST so app users show their real (higher) commit count
  const rows = await db.execute(sql`
    SELECT
      github_username,
      commit_count,
      avatar_url
    FROM (
      SELECT
        COALESCE(ec.github_username, cs.github_username) AS github_username,
        GREATEST(
          COALESCE(ec.commits, 0),
          COALESCE(cs.commits, 0)
        )::int AS commit_count,
        COALESCE(ec.avatar_url, u.avatar_url, 'https://github.com/' || COALESCE(ec.github_username, cs.github_username) || '.png') AS avatar_url
      FROM (
        SELECT github_username, SUM(commit_count) AS commits,
          (array_agg(avatar_url ORDER BY last_seen_at DESC))[1] AS avatar_url
        FROM event_committers
        WHERE date >= ${start} AND date <= ${end}
        GROUP BY github_username
      ) ec
      FULL OUTER JOIN (
        SELECT github_username, SUM(commit_count) AS commits
        FROM commit_snapshots
        WHERE date >= ${start} AND date <= ${end}
        GROUP BY github_username
      ) cs ON ec.github_username = cs.github_username
      LEFT JOIN users u ON u.github_username = COALESCE(ec.github_username, cs.github_username)
      WHERE COALESCE(ec.github_username, cs.github_username) NOT LIKE '%[bot]'
        AND COALESCE(ec.github_username, cs.github_username) NOT LIKE '%-bot'
        AND COALESCE(ec.github_username, cs.github_username) NOT IN ('dependabot', 'renovate', 'github-actions', 'greenkeeper', 'snyk-bot', 'codecov', 'imgbot', 'netlify', 'vercel', 'Copilot', 'github-merge-queue')
    ) merged
    WHERE commit_count > 0
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
