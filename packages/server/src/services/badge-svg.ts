/**
 * SVG badge generator for GitHub profile README embeds.
 *
 * Produces a self-contained SVG card displaying a user's Git Racer stats.
 * Two themes are supported: "dark" (default) and "light".
 *
 * The SVG is designed to render correctly inside GitHub READMEs where
 * external fonts and stylesheets are stripped. Uses only system fonts.
 */

interface BadgeStats {
  today: number;
  this_week: number;
  this_month: number;
  this_year: number;
  all_time: number;
}

interface BadgeStreaks {
  current_streak: number;
  longest_streak: number;
  trend_percent: number;
  this_week: number;
}

interface RenderOptions {
  username: string;
  stats: BadgeStats;
  streaks: BadgeStreaks;
  siteUrl: string;
}

const THEMES = {
  dark: {
    border: "#2A2A2A",
    text: "#F0F0F0",
    muted: "#666666",
    accent: "#00C853",
    red: "#EF4444",
  },
  light: {
    border: "#E0E0E0",
    text: "#1A1A1A",
    muted: "#666666",
    accent: "#00C853",
    red: "#EF4444",
  },
} as const;

const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

type Theme = { border: string; text: string; muted: string; accent: string; red: string };

function renderStatsGroup(
  id: string,
  t: Theme,
  safe: string,
  stats: BadgeStats,
  streaks: BadgeStreaks,
  siteUrl: string,
): string {
  const trendSign = streaks.trend_percent >= 0 ? "+" : "";
  const trendArrow = streaks.trend_percent > 0 ? " ↑" : streaks.trend_percent < 0 ? " ↓" : "";
  const trendColor =
    streaks.trend_percent > 0 ? t.accent : streaks.trend_percent < 0 ? t.red : t.muted;
  const trendText = `${trendSign}${streaks.trend_percent}%${trendArrow}`;

  return `<g id="${id}">
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ ${safe}'s Git Racer Stats</text>
  <line x1="25" y1="44" x2="775" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <text x="25" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="25" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.this_week)}</text>

  <text x="280" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">CURRENT STREAK</text>
  <text x="280" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${streaks.current_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <text x="540" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">LONGEST STREAK</text>
  <text x="540" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${streaks.longest_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <text x="25" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL-TIME</text>
  <text x="25" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.all_time)}</text>

  <text x="280" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="280" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.this_year)}</text>

  <text x="540" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">WEEK TREND</text>
  <text x="540" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${trendColor}">${escapeXml(trendText)}</text>

  <line x1="25" y1="160" x2="775" y2="160" stroke="${t.border}" stroke-width="1"/>
  <a href="${escapeXml(siteUrl)}">
    <text x="25" y="181" font-family="${FONT}" font-size="11" fill="${t.muted}">⚡ Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
  </g>`;
}

/**
 * Render a stats badge SVG card for a GitHub user.
 *
 * Always renders both dark and light themes, using CSS
 * `prefers-color-scheme` to auto-match the viewer's GitHub theme.
 * The SVG uses width="100%" so it stretches to fill the README.
 */
export function renderStatsBadge(options: RenderOptions): string {
  const { username, stats, streaks, siteUrl } = options;
  const safe = escapeXml(username);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="195" viewBox="0 0 800 195" fill="none">
  <style>
    #badge-dark { display: block; }
    #badge-light { display: none; }
    @media (prefers-color-scheme: light) {
      #badge-dark { display: none; }
      #badge-light { display: block; }
    }
  </style>
${renderStatsGroup("badge-dark", THEMES.dark, safe, stats, streaks, siteUrl)}
${renderStatsGroup("badge-light", THEMES.light, safe, stats, streaks, siteUrl)}
</svg>`;
}

/**
 * Render an error badge SVG (e.g. user not found).
 */
export function renderErrorBadge(message: string, siteUrl: string): string {
  const renderErrorGroup = (id: string, t: Theme) => `<g id="${id}">
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ Git Racer</text>
  <line x1="25" y1="44" x2="775" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <text x="25" y="72" font-family="${FONT}" font-size="14" fill="${t.muted}">${escapeXml(message)}</text>
  <line x1="25" y1="90" x2="775" y2="90" stroke="${t.border}" stroke-width="1"/>
  <a href="${escapeXml(siteUrl)}">
    <text x="25" y="110" font-family="${FONT}" font-size="11" fill="${t.muted}">⚡ Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120" viewBox="0 0 800 120" fill="none">
  <style>
    #err-dark { display: block; }
    #err-light { display: none; }
    @media (prefers-color-scheme: light) {
      #err-dark { display: none; }
      #err-light { display: block; }
    }
  </style>
${renderErrorGroup("err-dark", THEMES.dark)}
${renderErrorGroup("err-light", THEMES.light)}
</svg>`;
}
