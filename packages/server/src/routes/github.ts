/**
 * GitHub proxy routes -- search GitHub users without exposing API keys to the client.
 *
 * Wraps the GitHub user search API so the frontend can offer typeahead
 * suggestions when adding opponents or starred users.
 *
 * Endpoints:
 *   GET /search?q=...   Search GitHub users by username (public, no auth)
 */
import { Hono } from "hono";
import { searchGitHubUsers } from "../services/github.js";

export const githubRoutes = new Hono();

/** Search GitHub users by username prefix. Requires at least 2 characters. */
githubRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  // Require a minimum query length to avoid overly broad searches
  if (!q || q.length < 2) {
    return c.json([]);
  }

  const results = await searchGitHubUsers(q);
  return c.json(results);
});
