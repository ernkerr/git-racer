import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getBenchmarks } from "../services/famous-devs.js";
import { db } from "../db/index.js";
import { userBenchmarks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types.js";

export const benchmarkRoutes = new Hono<AppEnv>();

benchmarkRoutes.use("*", requireAuth);

benchmarkRoutes.get("/", async (c) => {
  const { sub: userId, username } = c.get("user");
  const period = (c.req.query("period") || "week") as "week" | "month" | "yearly";
  const benchmarks = await getBenchmarks(username, userId, period);
  return c.json(benchmarks);
});

benchmarkRoutes.post("/custom", async (c) => {
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

benchmarkRoutes.delete("/custom/:username", async (c) => {
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
