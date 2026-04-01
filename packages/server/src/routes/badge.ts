/**
 * Public badge routes -- SVG stats cards for GitHub profile READMEs.
 *
 * Returns an SVG image displaying a user's Git Racer stats. Designed to be
 * embedded via `<img>` tags in GitHub READMEs. No authentication required.
 *
 * Endpoints:
 *   GET /:username          SVG stats badge (query: ?theme=dark|light)
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { validateGitHubUser } from "../services/github.js";
import { refreshCommitData, getUserStatsFast } from "../services/commits.js";
import { renderStatsBadge, renderErrorBadge, type BadgeTheme } from "../services/badge-svg.js";
import { env } from "../lib/env.js";

export const badgeRoutes = new Hono();

// Badge images must be loadable from any origin (GitHub's camo proxy, direct browser access)
badgeRoutes.use("*", cors({ origin: "*" }));

badgeRoutes.get("/:username", async (c) => {
  const username = c.req.param("username");
  const theme = (c.req.query("theme") === "light" ? "light" : "dark") as BadgeTheme;
  const siteUrl = env.SITE_URL || env.CLIENT_URL;

  // Validate user exists on GitHub
  const ghUser = await validateGitHubUser(username);
  if (!ghUser) {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(renderErrorBadge("User not found", siteUrl, theme));
  }

  // Refresh commit cache (respects 4hr TTL)
  try {
    await refreshCommitData(ghUser.login);
  } catch (e) {
    console.error(`[badge] refreshCommitData failed for ${ghUser.login}:`, e);
  }

  const stats = await getUserStatsFast(ghUser.login);

  const svg = renderStatsBadge({
    username: ghUser.login,
    stats,
    siteUrl,
    theme,
  });

  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=1800, s-maxage=1800");
  return c.body(svg);
});
