/**
 * Suggested opponents routes -- public list of popular GitHub users to race against.
 *
 * The suggested opponents pool is populated by the daily-seed cron job from
 * GitHub's most-followed users. This endpoint serves them sorted by follower
 * count for the "find an opponent" UI.
 *
 * Endpoints:
 *   GET /   List suggested opponents, ordered by follower count (public, no auth)
 */
import { Hono } from "hono";
import { db } from "../db/index.js";
import { suggestedOpponents } from "../db/schema.js";
import { desc } from "drizzle-orm";

export const suggestedOpponentRoutes = new Hono();

/** List suggested opponents sorted by follower count. Capped at 100 results. */
suggestedOpponentRoutes.get("/", async (c) => {
  // Clamp limit to [1, 100] to prevent excessively large responses
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);

  const rows = await db
    .select({
      github_username: suggestedOpponents.github_username,
      avatar_url: suggestedOpponents.avatar_url,
      followers: suggestedOpponents.followers,
    })
    .from(suggestedOpponents)
    .orderBy(desc(suggestedOpponents.followers))
    .limit(limit);

  return c.json(rows);
});
