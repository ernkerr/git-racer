/**
 * Starred users routes -- manage the list of GitHub users a player is "racing" against.
 *
 * Starring a user adds them to the authenticated user's personal dashboard
 * where commit counts are compared side-by-side over configurable time periods.
 * Starred users are stored in the user_benchmarks table.
 *
 * Endpoints:
 *   GET    /             List starred user comparisons for a given period
 *   GET    /suggestions  Get suggested users to star (based on activity)
 *   POST   /             Star a new GitHub user
 *   DELETE /:username    Unstar a GitHub user
 */
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getStarredComparisons, getStarSuggestions } from "../services/starred-users.js";
import { db } from "../db/index.js";
import { userBenchmarks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types.js";

export const starredRoutes = new Hono<AppEnv>();

// All starred-user endpoints require authentication
starredRoutes.use("*", requireAuth);

/** List commit comparisons between the authenticated user and their starred users. */
starredRoutes.get("/", async (c) => {
  const { sub: userId, username } = c.get("user");
  const period = (c.req.query("period") || "week") as "week" | "month" | "yearly";
  const comparisons = await getStarredComparisons(username, userId, period);
  c.header("Cache-Control", "private, max-age=120");
  return c.json(comparisons);
});

/** Get personalized suggestions for users to star (e.g., active devs the user may know). */
starredRoutes.get("/suggestions", async (c) => {
  const { sub: userId } = c.get("user");
  const suggestions = await getStarSuggestions(userId);
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(suggestions);
});

/** Star a GitHub user by username. Normalizes to lowercase and silently ignores duplicates. */
starredRoutes.post("/", async (c) => {
  const { sub: userId } = c.get("user");
  const { github_username } = await c.req.json<{ github_username: string }>();

  if (!github_username || typeof github_username !== "string") {
    return c.json({ error: "github_username is required" }, 400);
  }

  // Normalize username to lowercase to avoid case-sensitive duplicates
  const normalizedUsername = github_username.trim().toLowerCase();

  await db
    .insert(userBenchmarks)
    .values({
      user_id: userId,
      github_username: normalizedUsername,
      display_name: normalizedUsername,
    })
    .onConflictDoNothing();

  return c.json({ ok: true, github_username: normalizedUsername });
});

/** Remove a starred user from the authenticated user's list. */
starredRoutes.delete("/:username", async (c) => {
  const { sub: userId } = c.get("user");
  const targetUsername = c.req.param("username");

  await db
    .delete(userBenchmarks)
    .where(
      and(
        eq(userBenchmarks.user_id, userId),
        eq(userBenchmarks.github_username, targetUsername)
      )
    );

  return c.json({ ok: true });
});
