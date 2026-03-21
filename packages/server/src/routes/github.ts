import { Hono } from "hono";
import { searchGitHubUsers } from "../services/github.js";

export const githubRoutes = new Hono();

githubRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 2) {
    return c.json([]);
  }

  const results = await searchGitHubUsers(q);
  return c.json(results);
});
