import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { challengeRoutes } from "./routes/challenges.js";
import { userRoutes } from "./routes/users.js";
import { githubRoutes } from "./routes/github.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { cronRoutes } from "./routes/cron.js";
import { suggestedOpponentRoutes } from "./routes/suggested-opponents.js";
import { leagueRoutes } from "./routes/leagues.js";
import { benchmarkRoutes } from "./routes/benchmarks.js";
import { starredRoutes } from "./routes/starred.js";
import { socialRoutes } from "./routes/social.js";

const app = new Hono().basePath("/api");

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  })
);

app.onError((err, c) => {
  console.error("Hono error:", err.message, err.stack);
  return c.json({ error: err.message }, 500);
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/challenges", challengeRoutes);
app.route("/users", userRoutes);
app.route("/github", githubRoutes);
app.route("/leaderboard", leaderboardRoutes);
app.route("/cron", cronRoutes);
app.route("/suggested-opponents", suggestedOpponentRoutes);
app.route("/leagues", leagueRoutes);
app.route("/benchmarks", benchmarkRoutes);
app.route("/starred", starredRoutes);
app.route("/social", socialRoutes);

export default app;
