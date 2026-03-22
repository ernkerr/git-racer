/**
 * User routes -- public user profile and commit statistics.
 *
 * Provides commit stats for any valid GitHub user. On each request the
 * user's commit data is refreshed from GitHub before returning stats,
 * ensuring the response reflects near-real-time activity.
 *
 * Endpoints:
 *   GET /:username/stats   Get commit statistics for a GitHub user (public, no auth)
 */
import { Hono } from "hono";
import { getUserStats, refreshCommitData } from "../services/commits.js";
import { validateGitHubUser } from "../services/github.js";

export const userRoutes = new Hono();

/**
 * Get commit statistics for a GitHub user.
 * Validates the username against the GitHub API first, then refreshes
 * local commit snapshot data before computing and returning stats.
 */
userRoutes.get("/:username/stats", async (c) => {
  const username = c.req.param("username");

  // Validate user exists on GitHub (also normalizes the username casing via ghUser.login)
  const ghUser = await validateGitHubUser(username);
  if (!ghUser) {
    return c.json({ error: "GitHub user not found" }, 404);
  }

  // Refresh commit snapshots from GitHub before computing stats
  await refreshCommitData(ghUser.login);
  const stats = await getUserStats(ghUser.login);

  return c.json({
    username: ghUser.login,
    avatar_url: ghUser.avatar_url,
    stats,
  });
});
