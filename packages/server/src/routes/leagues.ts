import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getUserLeague } from "../services/leagues.js";
import type { AppEnv } from "../types.js";

export const leagueRoutes = new Hono<AppEnv>();

leagueRoutes.use("*", requireAuth);

leagueRoutes.get("/current", async (c) => {
  const { sub: userId, username } = c.get("user");
  const league = await getUserLeague(userId, username);

  if (!league) {
    return c.json({ error: "Could not assign league" }, 500);
  }

  return c.json(league);
});
