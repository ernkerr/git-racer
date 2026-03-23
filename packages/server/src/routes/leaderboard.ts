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

  // GH Archive no longer includes per-push commit counts, so each push = 1
  // "commit" in event_committers. This means archive data is really push counts,
  // which lets green-square farmers dominate with hundreds of single-commit pushes.
  //
  // Solution: cap archive-only counts at a reasonable daily max (ARCHIVE_DAILY_CAP).
  // Users with GraphQL-verified data in commit_snapshots bypass the cap via GREATEST,
  // so real prolific developers still show their true numbers.
  const ARCHIVE_DAILY_CAP = 200;

  // The query is structured as:
  //   1. Subquery "ec": aggregate event_committers, capping per-day counts
  //   2. Subquery "cs": aggregate commit_snapshots (GraphQL-verified, uncapped)
  //   3. FULL OUTER JOIN so users in either source appear
  //   4. GREATEST picks the higher count — verified GraphQL data wins over capped archive
  //   5. Bot accounts are filtered by suffix patterns and an explicit blocklist
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
        SELECT github_username,
          SUM(LEAST(commit_count, ${ARCHIVE_DAILY_CAP})) AS commits,
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
