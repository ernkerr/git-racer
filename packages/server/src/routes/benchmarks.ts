import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { getBenchmarks } from "../services/famous-devs.js";
import type { AppEnv } from "../types.js";

export const benchmarkRoutes = new Hono<AppEnv>();

benchmarkRoutes.use("*", requireAuth);

benchmarkRoutes.get("/", async (c) => {
  const { username } = c.get("user");
  const period = (c.req.query("period") || "week") as "week" | "month" | "yearly";
  const benchmarks = await getBenchmarks(username, period);
  return c.json(benchmarks);
});
