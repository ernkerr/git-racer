/**
 * SVG badge generator for GitHub profile README embeds.
 *
 * Produces a self-contained SVG card displaying a user's Git Racer stats.
 * Three themes are supported: "dark", "light", and "auto" (default).
 * "auto" embeds CSS @media(prefers-color-scheme) rules so the badge
 * adapts to the viewer's system/browser dark-mode setting — ideal for
 * GitHub READMEs where a single <img> tag is all you need.
 *
 * The SVG is designed to render correctly inside GitHub READMEs where
 * external fonts and stylesheets are stripped. Uses only system fonts.
 */

export type BadgeTheme = "dark" | "light" | "auto";

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
    cyan: "#00C853",
    pink: "#00C853",
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
    cyan: "#00C853",
    pink: "#00C853",
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Render a stats badge SVG card for a GitHub user.
 */
export function renderStatsBadge(options: RenderOptions): string {
  const { username, stats, streaks, siteUrl, theme = "auto" } = options;
  const isAuto = theme === "auto";
  // For auto, light colors are the default; CSS overrides to dark when needed
  const t = isAuto ? THEMES.light : (THEMES[theme] ?? THEMES.dark);
  const safe = escapeXml(username);

  // Helper: conditionally adds CSS class attributes for auto-theming.
  // In auto mode, CSS media-query rules override the inline presentation attrs.
  const ac = (...cls: string[]) => isAuto ? ` class="${cls.join(" ")}"` : "";
  const autoStyle = isAuto
    ? `\n  <style>@media(prefers-color-scheme:dark){.ab{fill:${THEMES.dark.bg}}.av{fill:${THEMES.dark.value}}.as{stroke:${THEMES.dark.border}}}</style>`
    : "";

  const trendPositive = streaks.trend_percent >= 0;
  const trendColor = trendPositive ? t.cyan : t.pink;
  const trendText = `${trendPositive ? "+" : ""}${streaks.trend_percent}% VS LAST WK`;

  // Row 1: 5 stat columns
  const r1x = [25, 160, 295, 430, 565];
  // Row 2: 4 streak columns
  const r2x = [25, 195, 365, 535];


  const streakDots = Array.from({ length: Math.min(streaks.current_streak, 10) })
    .map((_, i) => {
      const opacity = (0.4 + (i / Math.max(Math.min(streaks.current_streak, 10), 1)) * 0.6).toFixed(2);
      return `<rect x="${r2x[0] + i * 10}" y="168" width="8" height="8" fill="${t.pink}" opacity="${opacity}"/>`;
    })
    .join("\n  ");

  const bestStreakBar = streaks.longest_streak > 0
    ? `<rect x="${r2x[1]}" y="168" width="120" height="8" fill="${t.bg}" stroke="${t.border}" stroke-width="1"${ac('ab','as')}/>
  <rect x="${r2x[1]}" y="168" width="${Math.min(120, Math.round((streaks.current_streak / streaks.longest_streak) * 120))}" height="8" fill="${t.accent}"/>
  <text x="${r2x[1]}" y="190" font-family="${FONT}" font-size="10" fill="${t.muted}">${streaks.current_streak >= streaks.longest_streak ? "NEW RECORD!" : `${streaks.longest_streak - streaks.current_streak} TO BEAT`}</text>`
    : "";

  const bestWeekDate = streaks.best_week_start
    ? `<text x="${r2x[3]}" y="176" font-family="${FONT}" font-size="10" fill="${t.muted}">${formatDate(streaks.best_week_start)}</text>`
    : "";

  const bestWeekBar = streaks.best_week_commits > 0
    ? `<rect x="${r2x[3]}" y="182" width="120" height="8" fill="${t.bg}" stroke="${t.border}" stroke-width="1"${ac('ab','as')}/>
  <rect x="${r2x[3]}" y="182" width="${Math.min(120, Math.round((streaks.this_week / streaks.best_week_commits) * 120))}" height="8" fill="${t.cyan}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="260" viewBox="0 0 700 260" fill="none">${autoStyle}
  <rect x="0.5" y="0.5" width="699" height="259" rx="4.5" fill="${t.bg}" stroke="${t.border}"${ac('ab','as')}/>

  <!-- Title bar -->
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">&#x26A1; ${safe}'s Git Racer Stats</text>
  <line x1="25" y1="44" x2="675" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Row 1: Commit stats -->
  <text x="${r1x[0]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">TODAY</text>
  <text x="${r1x[0]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(stats.today)}</text>

  <text x="${r1x[1]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="${r1x[1]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(stats.this_week)}</text>

  <text x="${r1x[2]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS MONTH</text>
  <text x="${r1x[2]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(stats.this_month)}</text>

  <text x="${r1x[3]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS YEAR</text>
  <text x="${r1x[3]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(stats.this_year)}</text>

  <text x="${r1x[4]}" y="70" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">ALL TIME</text>
  <text x="${r1x[4]}" y="92" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(stats.all_time)}</text>

  <!-- Divider -->
  <line x1="25" y1="110" x2="675" y2="110" stroke="${t.border}" stroke-width="1"${ac('as')}/>

  <!-- Row 2: Streak stats -->
  <text x="${r2x[0]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">CURRENT STREAK</text>
  <text x="${r2x[0]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${streaks.current_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>
  ${streakDots}

  <text x="${r2x[1]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">BEST STREAK</text>
  <text x="${r2x[1]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${streaks.longest_streak} <tspan font-size="12" fill="${t.muted}">days</tspan></text>
  ${bestStreakBar}

  <text x="${r2x[2]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">THIS WEEK</text>
  <text x="${r2x[2]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(streaks.this_week)}</text>
  <text x="${r2x[2]}" y="176" font-family="${FONT}" font-size="10" font-weight="700" fill="${trendColor}">${escapeXml(trendText)}</text>

  <text x="${r2x[3]}" y="136" font-family="${FONT}" font-size="11" fill="${t.muted}" letter-spacing="0.5">BEST WEEK</text>
  <text x="${r2x[3]}" y="158" font-family="${FONT}" font-size="20" font-weight="700" fill="${t.value}"${ac('av')}>${fmt(streaks.best_week_commits)}</text>
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
export function renderErrorBadge(message: string, siteUrl: string, theme: BadgeTheme = "auto"): string {
  const isAuto = theme === "auto";
  const t = isAuto ? THEMES.light : (THEMES[theme] ?? THEMES.dark);
  const ac = (...cls: string[]) => isAuto ? ` class="${cls.join(" ")}"` : "";
  const autoStyle = isAuto
    ? `\n  <style>@media(prefers-color-scheme:dark){.ab{fill:${THEMES.dark.bg}}.as{stroke:${THEMES.dark.border}}}</style>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="700" height="120" viewBox="0 0 700 120" fill="none">${autoStyle}
  <rect x="0.5" y="0.5" width="699" height="119" rx="4.5" fill="${t.bg}" stroke="${t.border}"${ac('ab','as')}/>
  <text x="25" y="32" font-family="${FONT}" font-size="14" font-weight="700" fill="${t.accent}">&#x26A1; Git Racer</text>
  <line x1="25" y1="44" x2="675" y2="44" stroke="${t.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <text x="25" y="72" font-family="${FONT}" font-size="14" fill="${t.muted}">${escapeXml(message)}</text>
  <line x1="25" y1="90" x2="675" y2="90" stroke="${t.border}" stroke-width="1"${ac('as')}/>
  <a xlink:href="${escapeXml(siteUrl)}">
    <text x="25" y="110" font-family="${FONT}" font-size="11" fill="${t.muted}">&#x26A1; Powered by <tspan fill="${t.accent}">GitRacer</tspan></text>
  </a>
</svg>`;
}
