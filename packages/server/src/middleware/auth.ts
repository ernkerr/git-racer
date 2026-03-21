import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyJWT } from "../lib/jwt.js";
import type { AppEnv } from "../types.js";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = await verifyJWT(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid session" }, 401);
  }
});

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, "session");
  if (token) {
    try {
      const payload = await verifyJWT(token);
      c.set("user", payload);
    } catch {
      // Invalid token — continue without auth
    }
  }
  await next();
});
