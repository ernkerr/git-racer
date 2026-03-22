/**
 * Leaderboard route -- ranks GitHub users by commit count over a
 * configurable time period (week, month, year, or all-time).
 *
 * Data is blended from two complementary sources:
 *   - event_committers:  aggregated from GH Archive public push events
 *                        (broad coverage -- all public GitHub users)
 *   - commit_snapshots:  precise counts fetched via GitHub GraphQL API
 *                        (higher accuracy for app users and tracked profiles)
 *
 * The query uses a FULL OUTER JOIN so users present in only one source
 * still appear, then picks the GREATEST count so the more accurate source
 * wins when both are available.
 */
import { Hono } from "hono";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { periodRange } from "../lib/dates.js";
import { BOT_USERNAMES } from "../lib/bot-filter.js";

export const leaderboardRoutes = new Hono();

// Pre-build the SQL-safe list of known bot usernames for the NOT IN clause.
// This is computed once at module load rather than per-request.
const botInList = BOT_USERNAMES.map((u) => `'${u}'`).join(", ");

leaderboardRoutes.get("/", async (c) => {
  const period = c.req.query("period") || "week";
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
  const { start, end } = periodRange(period);

  // The query is structured as:
  //   1. Subquery "ec": aggregate event_committers for the date range
  //   2. Subquery "cs": aggregate commit_snapshots for the date range
  //   3. FULL OUTER JOIN on github_username so users in either source appear
  //   4. GREATEST picks the higher commit count (GraphQL data is more accurate)
  //   5. Avatar resolution falls back through: event_committers -> users table -> GitHub URL
  //   6. Bot accounts are filtered out by suffix patterns and an explicit blocklist
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
        -- Filter out automated accounts that push thousands of times per day.
        -- A real developer rarely exceeds 200 pushes in a day; 500/day is generous.
        HAVING MAX(push_count) <= 500
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
        AND COALESCE(ec.github_username, cs.github_username) NOT IN (${sql.raw(botInList)})
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
