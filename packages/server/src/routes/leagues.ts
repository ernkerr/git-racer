/**
 * League routes -- weekly competitive leagues.
 *
 * Users are automatically placed into skill-based leagues each week.
 * This module exposes the authenticated user's current league placement
 * and standings.
 *
 * Endpoints:
 *   GET /current   Get the current user's league assignment and leaderboard
 */
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getUserLeague } from "../services/leagues.js";
import type { AppEnv } from "../types.js";

export const leagueRoutes = new Hono<AppEnv>();

// All league endpoints require authentication
leagueRoutes.use("*", requireAuth);

/** Retrieve the authenticated user's current weekly league and standings. */
leagueRoutes.get("/current", async (c) => {
  const { sub: userId, username } = c.get("user");
  const league = await getUserLeague(userId, username);

  if (!league) {
    return c.json({ error: "Could not assign league" }, 500);
  }

  return c.json(league);
});
