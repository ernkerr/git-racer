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
    value: "#FFFFFF",
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
    value: "#333333",
    muted: "#666666",
    accent: "#00C853",
    red: "#EF4444",
    footerBg: "#F0F0F0",
  },
} as const;

const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif";

const CAR_PNG_B64 = "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";

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

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="195" viewBox="0 0 700 195" fill="none">
  <rect x="0.5" y="0.5" width="699" height="194" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>

  <!-- Title bar -->
  <text x="20" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ ${safe}'s Git Racer Stats</text>
  <image x="648" y="12" width="30" height="20" href="data:image/png;base64,${CAR_PNG_B64}"/>
  <line x1="20" y1="44" x2="680" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Row 1: This Week | Current Streak | Longest Streak -->
  <text x="20" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" text-transform="uppercase" letter-spacing="0.5">THIS WEEK</text>
  <text x="20" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.this_week)}</text>

  <text x="250" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">CURRENT STREAK</text>
  <text x="250" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${streaks.current_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <text x="480" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">LONGEST STREAK</text>
  <text x="480" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${streaks.longest_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>

  <!-- Row 2: All-Time | This Year | Trend -->
  <text x="20" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL-TIME</text>
  <text x="20" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.all_time)}</text>

  <text x="250" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="250" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.this_year)}</text>

  <text x="480" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">WEEK TREND</text>
  <text x="480" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${trendColor}">${escapeXml(trendText)}</text>

  <!-- Footer -->
  <line x1="20" y1="160" x2="680" y2="160" stroke="${t.muted}" stroke-opacity="0.3" stroke-width="1"/>
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

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="120" viewBox="0 0 700 120" fill="none">
  <rect x="0.5" y="0.5" width="699" height="119" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>
  <text x="20" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ Git Racer</text>
  <line x1="20" y1="44" x2="680" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <text x="20" y="72" font-family="${FONT}" font-size="14" fill="${t.muted}">${escapeXml(message)}</text>
  <line x1="20" y1="90" x2="680" y2="90" stroke="${t.border}" stroke-width="1"/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="20" y="110" font-family="${FONT}" font-size="11" fill="${t.muted}">⚡ Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
</svg>`;
}
