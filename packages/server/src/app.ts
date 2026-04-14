/**
 * Main Hono application entry point.
 *
 * Configures global middleware (CORS, logging, error handling) and
 * mounts all API route modules under the /api base path.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./lib/env.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { challengeRoutes } from "./routes/challenges.js";
import { userRoutes } from "./routes/users.js";
import { githubRoutes } from "./routes/github.js";
import { cronRoutes } from "./routes/cron.js";
import { suggestedOpponentRoutes } from "./routes/suggested-opponents.js";
import { leagueRoutes } from "./routes/leagues.js";
import { starredRoutes } from "./routes/starred.js";
import { socialRoutes } from "./routes/social.js";
import { ogRoutes } from "./routes/og.js";
import { badgeRoutes } from "./routes/badge.js";

const app = new Hono().basePath("/api");

// --- Global middleware ---
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // allow session cookie to be sent cross-origin
  })
);

// Catch-all error handler: logs the full stack trace and returns a JSON error
app.onError((err, c) => {
  console.error("Hono error:", err.message, err.stack);
  return c.json({ error: err.message }, 500);
});

// Simple liveness probe for load balancers / health checks
app.get("/health", (c) => c.json({ status: "ok" }));

// --- Route modules ---
app.route("/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/challenges", challengeRoutes);
app.route("/users", userRoutes);
app.route("/github", githubRoutes);
app.route("/cron", cronRoutes);
app.route("/suggested-opponents", suggestedOpponentRoutes);
app.route("/leagues", leagueRoutes);
app.route("/starred", starredRoutes);
app.route("/social", socialRoutes);
app.route("/og", ogRoutes);
app.route("/badge", badgeRoutes);

export default app;
