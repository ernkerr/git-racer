import { Hono } from "hono";
import { getUserStats, refreshCommitData } from "../services/commits.js";
import { validateGitHubUser } from "../services/github.js";

export const userRoutes = new Hono();

userRoutes.get("/:username/stats", async (c) => {
  const username = c.req.param("username");

  // Validate user exists on GitHub
  const ghUser = await validateGitHubUser(username);
  if (!ghUser) {
    return c.json({ error: "GitHub user not found" }, 404);
  }

  await refreshCommitData(ghUser.login);
  const stats = await getUserStats(ghUser.login);

  return c.json({
    username: ghUser.login,
    avatar_url: ghUser.avatar_url,
    stats,
  });
});
