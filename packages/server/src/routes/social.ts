/**
 * Social routes -- social circle commit rankings.
 *
 * Ranks the authenticated user's GitHub following/followers by commit
 * activity. Requires the user's stored GitHub access token to call the
 * GitHub API for their social graph.
 *
 * Endpoints:
 *   GET /circle   Get commit rankings for the user's GitHub social circle
 */
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getSocialCircleRanking } from "../services/social-circle.js";
import type { AppEnv } from "../types.js";

export const socialRoutes = new Hono<AppEnv>();

// All social endpoints require authentication
socialRoutes.use("*", requireAuth);

/**
 * Get the authenticated user's social circle ranked by commit activity.
 * Fetches the user's GitHub access token from the DB so the service layer
 * can query the GitHub API for their followers/following list.
 */
socialRoutes.get("/circle", async (c) => {
  const { sub: userId, username } = c.get("user");

  // Retrieve the user's stored GitHub OAuth access token
  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  const data = await getSocialCircleRanking(userId, username, user.access_token);
  return c.json(data);
});
