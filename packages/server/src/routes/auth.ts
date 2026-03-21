import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { env } from "../lib/env.js";
import { signJWT } from "../lib/jwt.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authRoutes = new Hono();

authRoutes.get("/github", (c) => {
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${env.API_URL}/api/auth/github/callback`,
    scope: "read:user",
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");

  deleteCookie(c, "oauth_state");

  if (!code || !state || state !== storedState) {
    return c.redirect(`${env.CLIENT_URL}?error=auth_failed`);
  }

  // Exchange code for access token
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

  // Fetch GitHub user profile
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

  // Upsert user
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

  // Sign JWT and set cookie
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

authRoutes.post("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
