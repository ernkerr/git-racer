/**
 * Authentication routes -- GitHub OAuth 2.0 login flow and logout.
 *
 * Flow:
 *  1. GET /github          - Redirects to GitHub's OAuth authorization page
 *  2. GET /github/callback - Handles the OAuth callback, exchanges the code
 *                            for an access token, upserts the user, and sets
 *                            a session JWT cookie
 *  3. POST /logout         - Clears the session cookie
 */
import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { env } from "../lib/env.js";
import { signJWT } from "../lib/jwt.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authRoutes = new Hono();

/**
 * Step 1 -- Initiate GitHub OAuth.
 * Generates a random state token (CSRF protection), stores it in a
 * short-lived httpOnly cookie, and redirects the browser to GitHub.
 */
authRoutes.get("/github", (c) => {
  const oauthState = crypto.randomUUID();
  setCookie(c, "oauth_state", oauthState, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 300, // 5 minutes -- generous window for the user to authorize
    path: "/",
  });

  const authorizationParams = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${env.API_URL}/api/auth/github/callback`,
    scope: "read:user",
    state: oauthState,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${authorizationParams}`);
});

/**
 * Step 2 -- OAuth callback handler.
 * Validates the state parameter against the stored cookie to prevent CSRF,
 * exchanges the authorization code for a GitHub access token, fetches the
 * user's profile, upserts the local DB record, and issues a session JWT.
 */
authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");

  // Always clear the one-time state cookie regardless of outcome
  deleteCookie(c, "oauth_state");

  if (!code || !state || state !== storedState) {
    return c.redirect(`${env.CLIENT_URL}?error=auth_failed`);
  }

  // Exchange the temporary authorization code for a long-lived access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    return c.redirect(`${env.CLIENT_URL}?error=token_exchange_failed`);
  }

  // Fetch the authenticated GitHub user's profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });

  const githubUser = (await userRes.json()) as {
    id: number;
    login: string;
    avatar_url: string;
  };

  // Upsert: update existing user or create a new record.
  // We match on github_id (immutable) and always refresh the username,
  // avatar, and access token in case they've changed since last login.
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.github_id, githubUser.id))
    .limit(1);

  let userId: number;

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        github_username: githubUser.login,
        avatar_url: githubUser.avatar_url,
        access_token: tokenData.access_token,
      })
      .where(eq(users.github_id, githubUser.id));
    userId = existing[0].id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        github_id: githubUser.id,
        github_username: githubUser.login,
        avatar_url: githubUser.avatar_url,
        access_token: tokenData.access_token,
      })
      .returning({ id: users.id });
    userId = newUser.id;
  }

  // Issue a signed JWT and store it as an httpOnly session cookie
  const jwt = await signJWT(userId, githubUser.login);
  setCookie(c, "session", jwt, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return c.redirect(`${env.CLIENT_URL}/dashboard`);
});

/** Step 3 -- Logout: clear the session cookie. */
authRoutes.post("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
