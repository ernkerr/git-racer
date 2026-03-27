/**
 * SVG badge generator for GitHub profile README embeds.
 *
 * Produces a self-contained SVG card displaying a user's Git Racer stats.
 * Two themes are supported: "dark" (default) and "light".
 *
 * The SVG is designed to render correctly inside GitHub READMEs where
 * external fonts and stylesheets are stripped. Uses only system fonts.
 */

export type BadgeTheme = "dark" | "light";

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
  theme?: BadgeTheme;
}

const THEMES = {
  dark: {
    bg: "#0C0C0C",
    surface: "#141414",
    border: "#2A2A2A",
    text: "#F0F0F0",
    muted: "#666666",
    accent: "#00C853",
    red: "#EF4444",
    footerBg: "#0A0A0A",
  },
  light: {
    bg: "#FFFFFF",
    surface: "#F8F8F8",
    border: "#E0E0E0",
    text: "#1A1A1A",
    muted: "#666666",
    accent: "#00C853",
    red: "#EF4444",
    footerBg: "#F0F0F0",
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

/**
 * Render a stats badge SVG card for a GitHub user.
 */
export function renderStatsBadge(options: RenderOptions): string {
  const { username, stats, streaks, siteUrl, theme = "dark" } = options;
  const t = THEMES[theme] ?? THEMES.dark;
  const safe = escapeXml(username);

  const trendSign = streaks.trend_percent >= 0 ? "+" : "";
  const trendArrow = streaks.trend_percent > 0 ? " ↑" : streaks.trend_percent < 0 ? " ↓" : "";
  const trendColor =
    streaks.trend_percent > 0 ? t.accent : streaks.trend_percent < 0 ? t.red : t.muted;
  const trendText = `${trendSign}${streaks.trend_percent}%${trendArrow}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="495" height="195" viewBox="0 0 495 195" fill="none">
  <rect x="0.5" y="0.5" width="494" height="194" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>

  <!-- Title bar -->
  <text x="20" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ ${safe}'s Git Racer Stats</text>
  <line x1="20" y1="44" x2="475" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Row 1: This Week | Current Streak | Longest Streak -->
  <text x="20" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" text-transform="uppercase" letter-spacing="0.5">THIS WEEK</text>
  <text x="20" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.this_week)}</text>

  <text x="180" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">CURRENT STREAK</text>
  <text x="180" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${streaks.current_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <text x="345" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">LONGEST STREAK</text>
  <text x="345" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${streaks.longest_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <!-- Row 2: All-Time | This Year | Trend -->
  <text x="20" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL-TIME</text>
  <text x="20" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.all_time)}</text>

  <text x="180" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="180" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.text}">${fmt(stats.this_year)}</text>

  <text x="345" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">WEEK TREND</text>
  <text x="345" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${trendColor}">${escapeXml(trendText)}</text>

  <!-- Footer -->
  <line x1="20" y1="160" x2="475" y2="160" stroke="${t.border}" stroke-width="1"/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="20" y="181" font-family="${FONT}" font-size="11" fill="${t.muted}">⚡ Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
</svg>`;
}

/**
 * Render an error badge SVG (e.g. user not found).
 */
export function renderErrorBadge(message: string, siteUrl: string, theme: BadgeTheme = "dark"): string {
  const t = THEMES[theme] ?? THEMES.dark;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="495" height="120" viewBox="0 0 495 120" fill="none">
  <rect x="0.5" y="0.5" width="494" height="119" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>
  <text x="20" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ Git Racer</text>
  <line x1="20" y1="44" x2="475" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <text x="20" y="72" font-family="${FONT}" font-size="14" fill="${t.muted}">${escapeXml(message)}</text>
  <line x1="20" y1="90" x2="475" y2="90" stroke="${t.border}" stroke-width="1"/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="20" y="110" font-family="${FONT}" font-size="11" fill="${t.muted}">⚡ Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
</svg>`;
}
