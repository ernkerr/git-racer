import type { JWTPayload } from "./lib/jwt.js";

/** Hono environment type. Defines variables available via c.get(). */
export type AppEnv = {
  Variables: {
    user: JWTPayload; // Set by requireAuth/optionalAuth middleware
  };
};
