import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verifyJWT } from "../lib/jwt.js";
import type { AppEnv } from "../types.js";

/** Requires a valid session cookie. Returns 401 if missing or invalid. */
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

/** Attaches user context if a valid session exists, but doesn't require it. */
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, "session");
  if (token) {
    try {
      const payload = await verifyJWT(token);
      c.set("user", payload);
    } catch {
      // Invalid or expired token — continue without auth context
    }
  }
  await next();
});
