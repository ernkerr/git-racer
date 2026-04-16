/** How long before cached commit data is considered stale (4 hours) */
export const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

/** Length of the share slug for challenges */
export const SLUG_LENGTH = 8;

/** Max participants in a team challenge */
export const MAX_TEAM_SIZE = 50;

/** Auto-refresh interval on challenge page (60 seconds) */
export const CHALLENGE_REFRESH_MS = 60 * 1000;

/** League configuration */
export const LEAGUE_GROUP_SIZE = 30;
export const LEAGUE_PROMOTE_COUNT = 5;
export const LEAGUE_DEMOTE_COUNT = 5;
export const LEAGUE_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;

/** Duration presets for race creation */
export const DURATION_PRESETS = {
  "1day": { label: "1 Day", days: 1 },
  "2days": { label: "2 Days", days: 2 },
  "3days": { label: "3 Days", days: 3 },
  "1week": { label: "1 Week", days: 7 },
  "1quarter": { label: "Quarter", days: 90 },
  "ongoing": { label: "Ongoing", days: null },
} as const;

/** Social circle cache duration (6 hours) */
export const SOCIAL_CIRCLE_CACHE_MS = 6 * 60 * 60 * 1000;
