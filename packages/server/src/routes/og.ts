/**
 * Open Graph meta tag routes for social media link previews.
 *
 * These endpoints return server-rendered HTML pages with proper OG meta tags
 * so that social media crawlers (Twitter, Facebook, Slack, Discord, etc.)
 * can generate rich link previews when users share challenge URLs.
 *
 * Real browsers are immediately redirected to the SPA via a meta refresh tag.
 *
 * Endpoints:
 *   GET /c/:slug   Challenge page OG preview
 */
import { Hono } from "hono";
import { db } from "../db/index.js";
import { challenges } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { env } from "../lib/env.js";

export const ogRoutes = new Hono();

/** GET /c/:slug -- Serve an HTML page with OG meta tags for a challenge. */
ogRoutes.get("/c/:slug", async (c) => {
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) {
    return c.html(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${env.CLIENT_URL}/c/${slug}"></head><body><p>Challenge not found.</p></body></html>`,
      404
    );
  }

  // Date range for commit aggregation
  const startDate = challenge.start_date.toISOString().slice(0, 10);
  const endDate = challenge.end_date
    ? challenge.end_date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Participant commit totals (same as challenges.ts GET /:slug)
  const rows = await db.execute(sql`
    SELECT
      cp.github_username,
      COALESCE(SUM(cs.commit_count), 0)::int AS commit_count
    FROM challenge_participants cp
    LEFT JOIN commit_snapshots cs
      ON cs.github_username = cp.github_username
      AND cs.date >= ${startDate}
      AND cs.date <= ${endDate}
    WHERE cp.challenge_id = ${challenge.id}
    GROUP BY cp.github_username
    ORDER BY commit_count DESC
  `);

  const participants = rows.rows as { github_username: string; commit_count: number }[];
  const racerCount = participants.length;

  // Build a competitive description
  let description: string;
  if (racerCount === 0) {
    description = "No racers yet. Be the first to join!";
  } else {
    const leader = participants[0];
    const commitWord = Number(leader.commit_count) === 1 ? "commit" : "commits";
    const racerWord = racerCount === 1 ? "racer" : "racers";
    description = `${leader.github_username} leads with ${leader.commit_count} ${commitWord} | ${racerCount} ${racerWord} competing`;
  }

  const title = `${challenge.name} | Git Racer`;
  const pageUrl = `${env.CLIENT_URL}/c/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeAttr(pageUrl)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">

  <!-- Redirect real browsers to the SPA -->
  <meta http-equiv="refresh" content="0;url=${escapeAttr(pageUrl)}">
</head>
<body>
  <h1>${escapeHtml(challenge.name)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeAttr(pageUrl)}">View on Git Racer</a></p>
</body>
</html>`;

  return c.html(html);
});

/** Escape HTML special characters to prevent XSS in rendered pages. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a string for use inside an HTML attribute value (double-quoted). */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
