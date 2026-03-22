/**
 * Shared bot detection for filtering automated GitHub accounts.
 *
 * Single source of truth — imported by GH Archive ingestion, real-time
 * event polling, and leaderboard queries. Add new bot patterns here
 * and they'll be filtered everywhere.
 */

/** Regex patterns that match known bot usernames. */
const BOT_PATTERNS = [
  /\[bot\]$/i,          // GitHub App bots (e.g., "dependabot[bot]")
  /-bot$/i,             // Convention-based bot suffix
  /^dependabot$/i,
  /^renovate$/i,
  /^github-actions$/i,
  /^greenkeeper$/i,
  /^snyk-bot$/i,
  /^codecov$/i,
  /^imgbot$/i,
  /^netlify$/i,
  /^vercel$/i,
  /^copilot$/i,
  /^github-merge-queue$/i,
];

/**
 * Bot usernames for SQL WHERE NOT IN clauses.
 * Must stay in sync with BOT_PATTERNS above — these are the exact-match
 * names for use in raw SQL where regex isn't available.
 */
export const BOT_USERNAMES = [
  "dependabot", "renovate", "github-actions", "greenkeeper",
  "snyk-bot", "codecov", "imgbot", "netlify", "vercel",
  "Copilot", "github-merge-queue",
];

/** Returns true if the username matches a known bot pattern. */
export function isBot(username: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(username));
}

/**
 * Max commits counted per single push event.
 * A push with 1,000+ commits is almost always automated (dependency updates,
 * generated code, CI artifacts). Capping at 50 lets normal development through
 * while limiting abuse on the leaderboard.
 */
export const MAX_COMMITS_PER_PUSH = 50;
