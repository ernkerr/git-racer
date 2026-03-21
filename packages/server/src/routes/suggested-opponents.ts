import { Hono } from "hono";
import { db } from "../db/index.js";
import { suggestedOpponents } from "../db/schema.js";
import { desc } from "drizzle-orm";

export const suggestedOpponentRoutes = new Hono();

suggestedOpponentRoutes.get("/", async (c) => {
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
