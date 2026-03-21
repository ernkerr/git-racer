import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getSocialCircleRanking } from "../services/social-circle.js";
import type { AppEnv } from "../types.js";

export const socialRoutes = new Hono<AppEnv>();

socialRoutes.use("*", requireAuth);

socialRoutes.get("/circle", async (c) => {
  const { sub: userId, username } = c.get("user");

  // Get user's access token for GitHub API
  const [user] = await db
    .select({ access_token: users.access_token })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  const data = await getSocialCircleRanking(userId, username, user.access_token);
  return c.json(data);
});
