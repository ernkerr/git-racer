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
  best_week_commits: number;
  best_week_start: string | null;
  this_week: number;
  trend_percent: number;
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
    cyan: "#22D3EE",
    pink: "#EC4899",
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
    cyan: "#0891B2",
    pink: "#DB2777",
  },
} as const;

const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif";

// 200x133 car-green.png — high-res source rendered with pixelated scaling for crisp pixel art
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Render a stats badge SVG card for a GitHub user.
 */
export function renderStatsBadge(options: RenderOptions): string {
  const { username, stats, streaks, siteUrl, theme = "dark" } = options;
  const t = THEMES[theme] ?? THEMES.dark;
  const safe = escapeXml(username);

  const trendPositive = streaks.trend_percent >= 0;
  const trendColor = trendPositive ? t.cyan : t.pink;
  const trendText = `${trendPositive ? "+" : ""}${streaks.trend_percent}% VS LAST WK`;

  // Row 1: 5 stat columns
  const r1x = [25, 160, 295, 430, 565];
  // Row 2: 4 streak columns
  const r2x = [25, 195, 365, 535];

  const carW = 80;
  const carH = 53;

  const streakDots = Array.from({ length: Math.min(streaks.current_streak, 10) })
    .map((_, i) => {
      const opacity = (0.4 + (i / Math.max(Math.min(streaks.current_streak, 10), 1)) * 0.6).toFixed(2);
      return `<rect x="${r2x[0] + i * 10}" y="168" width="8" height="8" fill="${t.pink}" opacity="${opacity}"/>`;
    })
    .join("\n  ");

  const bestStreakBar = streaks.longest_streak > 0
    ? `<rect x="${r2x[1]}" y="168" width="120" height="8" fill="${t.bg}" stroke="${t.border}" stroke-width="1"/>
  <rect x="${r2x[1]}" y="168" width="${Math.min(120, Math.round((streaks.current_streak / streaks.longest_streak) * 120))}" height="8" fill="${t.accent}"/>
  <text x="${r2x[1]}" y="190" font-family="${FONT}" font-size="10" fill="${t.muted}">${streaks.current_streak >= streaks.longest_streak ? "NEW RECORD!" : `${streaks.longest_streak - streaks.current_streak} TO BEAT`}</text>`
    : "";

  const bestWeekDate = streaks.best_week_start
    ? `<text x="${r2x[3]}" y="176" font-family="${FONT}" font-size="10" fill="${t.muted}">${formatDate(streaks.best_week_start)}</text>`
    : "";

  const bestWeekBar = streaks.best_week_commits > 0
    ? `<rect x="${r2x[3]}" y="182" width="120" height="8" fill="${t.bg}" stroke="${t.border}" stroke-width="1"/>
  <rect x="${r2x[3]}" y="182" width="${Math.min(120, Math.round((streaks.this_week / streaks.best_week_commits) * 120))}" height="8" fill="${t.cyan}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="260" viewBox="0 0 700 260" fill="none">
  <rect x="0.5" y="0.5" width="699" height="259" rx="4.5" fill="${t.bg}" stroke="${t.border}"/>

  <!-- Title bar -->
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">&#x26A1; ${safe}'s Git Racer Stats</text>
  <image x="${700 - carW - 30}" y="${Math.round((44 - carH) / 2)}" width="${carW}" height="${carH}" href="data:image/png;base64,${CAR_PNG_B64}" style="image-rendering:pixelated"/>
  <line x1="25" y1="44" x2="675" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Row 1: Commit stats -->
  <text x="${r1x[0]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">TODAY</text>
  <text x="${r1x[0]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(stats.today)}</text>

  <text x="${r1x[1]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="${r1x[1]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(stats.this_week)}</text>

  <text x="${r1x[2]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS MONTH</text>
  <text x="${r1x[2]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(stats.this_month)}</text>

  <text x="${r1x[3]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="${r1x[3]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(stats.this_year)}</text>

  <text x="${r1x[4]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL TIME</text>
  <text x="${r1x[4]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(stats.all_time)}</text>

  <!-- Divider -->
  <line x1="25" y1="110" x2="675" y2="110" stroke="${t.border}" stroke-width="1"/>

  <!-- Row 2: Streak stats -->
  <text x="${r2x[0]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">CURRENT STREAK</text>
  <text x="${r2x[0]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${streaks.current_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>
  ${streakDots}

  <text x="${r2x[1]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">BEST STREAK</text>
  <text x="${r2x[1]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${streaks.longest_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>
  ${bestStreakBar}

  <text x="${r2x[2]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="${r2x[2]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(streaks.this_week)}</text>
  <text x="${r2x[2]}" y="176" font-family="${FONT}" font-size="10" font-weight="700" fill="${trendColor}">${escapeXml(trendText)}</text>

  <text x="${r2x[3]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">BEST WEEK</text>
  <text x="${r2x[3]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}">${fmt(streaks.best_week_commits)}</text>
  ${bestWeekDate}
  ${bestWeekBar}

  <!-- Footer -->
  <line x1="25" y1="225" x2="675" y2="225" stroke="${t.muted}" stroke-opacity="0.3" stroke-width="1"/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="25" y="246" font-family="${FONT}" font-size="11" fill="${t.muted}">&#x26A1; Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
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
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">&#x26A1; Git Racer</text>
  <line x1="25" y1="44" x2="675" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <text x="25" y="72" font-family="${FONT}" font-size="14" fill="${t.muted}">${escapeXml(message)}</text>
  <line x1="25" y1="90" x2="675" y2="90" stroke="${t.border}" stroke-width="1"/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="25" y="110" font-family="${FONT}" font-size="11" fill="${t.muted}">&#x26A1; Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
</svg>`;
}
