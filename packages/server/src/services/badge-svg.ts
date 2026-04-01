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

interface RenderOptions {
  username: string;
  stats: BadgeStats;
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
  const { username, stats, siteUrl, theme = "dark" } = options;
  const t = THEMES[theme] ?? THEMES.dark;
  const safe = escapeXml(username);

  // Car: 80x53 source, rendered at 60x40 in SVG for sharpness
  const carW = 60;
  const carH = 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="195" viewBox="0 0 700 195" fill="none">
  <rect x="0.5" y="0.5" width="699" height="194" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>

  <!-- Title bar -->
  <text x="20" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">⚡ ${safe}'s Git Racer Stats</text>
  <image x="${700 - carW - 25}" y="${Math.round((44 - carH) / 2)}" width="${carW}" height="${carH}" href="data:image/png;base64,${CAR_PNG_B64}"/>
  <line x1="20" y1="44" x2="680" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Row 1: Today | This Week | This Month -->
  <text x="20" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">TODAY</text>
  <text x="20" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.today)}</text>

  <text x="250" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="250" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.this_week)}</text>

  <text x="480" y="72" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS MONTH</text>
  <text x="480" y="92" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.this_month)}</text>

  <!-- Row 2: This Year | All Time -->
  <text x="20" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="20" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.this_year)}</text>

  <text x="250" y="122" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL TIME</text>
  <text x="250" y="142" font-family="${FONT}" font-size="18" font-weight="700" fill="${t.value}">${fmt(stats.all_time)}</text>

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
