/**
 * Benchmark routes -- compare commit activity against famous developers.
 *
 * Users can view how their commit counts stack up against well-known
 * open-source developers, and add/remove custom benchmark targets.
 * Custom benchmarks are stored in the user_benchmarks table.
 *
 * Endpoints:
 *   GET    /                  Get benchmark comparisons for the authenticated user
 *   POST   /custom            Add a custom benchmark target by GitHub username
 *   DELETE /custom/:username  Remove a custom benchmark target
 */
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getBenchmarks } from "../services/famous-devs.js";
import { db } from "../db/index.js";
import { userBenchmarks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types.js";

export const benchmarkRoutes = new Hono<AppEnv>();

// All benchmark endpoints require authentication
benchmarkRoutes.use("*", requireAuth);

/** Get commit comparisons between the authenticated user and famous/custom benchmark devs. */
benchmarkRoutes.get("/", async (c) => {
  const { sub: userId, username } = c.get("user");
  const period = (c.req.query("period") || "week") as "week" | "month" | "yearly";
  const benchmarks = await getBenchmarks(username, userId, period);
  return c.json(benchmarks);
});

/** Add a custom benchmark target. Normalizes to lowercase and silently ignores duplicates. */
benchmarkRoutes.post("/custom", async (c) => {
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

/** Remove a custom benchmark target for the authenticated user. */
benchmarkRoutes.delete("/custom/:username", async (c) => {
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
