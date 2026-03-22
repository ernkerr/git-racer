import { sign, verify } from "hono/jwt";
import { env } from "./env.js";

export interface JWTPayload {
  sub: number; // user ID
  username: string; // GitHub username
  exp: number; // expiration timestamp (seconds since epoch)
  [key: string]: unknown;
}

/**
 * Parse a duration string like "7d", "24h", "30m", "3600s" into seconds.
 * Falls back to 7 days if the format is unrecognized.
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60; // default: 7 days
  const [, value, unit] = match;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(value) * (multipliers[unit] || 86400);
}

export async function signJWT(userId: number, username: string): Promise<string> {
  const expiresIn = parseExpiry(env.JWT_EXPIRY);
  const payload: JWTPayload = {
    sub: userId,
    username,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };
  return sign(payload, env.SESSION_SECRET);
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const result = await verify(token, env.SESSION_SECRET, "HS256");
  return result as unknown as JWTPayload;
}
