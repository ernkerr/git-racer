import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getStarredComparisons, getStarSuggestions } from "../services/starred-users.js";
import { db } from "../db/index.js";
import { userBenchmarks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types.js";

export const starredRoutes = new Hono<AppEnv>();

starredRoutes.use("*", requireAuth);

starredRoutes.get("/", async (c) => {
  const { sub: userId, username } = c.get("user");
  const period = (c.req.query("period") || "week") as "week" | "month" | "yearly";
  const comparisons = await getStarredComparisons(username, userId, period);
  return c.json(comparisons);
});

starredRoutes.get("/suggestions", async (c) => {
  const { sub: userId } = c.get("user");
  const suggestions = await getStarSuggestions(userId);
  return c.json(suggestions);
});

starredRoutes.post("/", async (c) => {
  const { sub: userId } = c.get("user");
  const { github_username } = await c.req.json<{ github_username: string }>();

  if (!github_username || typeof github_username !== "string") {
    return c.json({ error: "github_username is required" }, 400);
  }

  const clean = github_username.trim().toLowerCase();

  await db
    .insert(userBenchmarks)
    .values({
      user_id: userId,
      github_username: clean,
      display_name: clean,
    })
    .onConflictDoNothing();

  return c.json({ ok: true, github_username: clean });
});

starredRoutes.delete("/:username", async (c) => {
  const { sub: userId } = c.get("user");
  const target = c.req.param("username");

  await db
    .delete(userBenchmarks)
    .where(
      and(
        eq(userBenchmarks.user_id, userId),
        eq(userBenchmarks.github_username, target)
      )
    );

  return c.json({ ok: true });
});
