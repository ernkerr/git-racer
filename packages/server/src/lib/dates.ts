/**
 * Date utilities for Git Racer.
 *
 * All functions return YYYY-MM-DD strings in UTC. We use .toISOString().slice(0, 10)
 * which always produces UTC dates regardless of server timezone. Day-of-week
 * calculations use getDay() on Date objects constructed from ISO strings, which
 * is consistent as long as the server doesn't cross a UTC day boundary mid-call.
 */

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: Date = new Date()): string {
  const dow = d.getDay() || 7; // convert Sunday (0) to 7 for ISO week math
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow + 1);
  return mon.toISOString().slice(0, 10);
}

/** Sunday of the week containing `d`, as YYYY-MM-DD. */
export function weekEnd(d: Date = new Date()): string {
  const dow = d.getDay() || 7;
  const sun = new Date(d);
  sun.setDate(d.getDate() - dow + 7);
  return sun.toISOString().slice(0, 10);
}

/** First day of the month containing `d`, as YYYY-MM-DD. */
export function monthStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Jan 1 of the year containing `d`, as YYYY-MM-DD. */
export function yearStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-01-01`;
}

/** Today's date as YYYY-MM-DD (UTC). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Yesterday's date as YYYY-MM-DD (UTC). */
export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * ISO 8601 week number for a given date.
 * Week 1 is the week containing the year's first Thursday.
 */
export function isoWeek(d: Date = new Date()): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Adjust to nearest Thursday (ISO weeks start on Monday)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** Tomorrow's date as YYYY-MM-DD (UTC). */
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Add `n` days to a YYYY-MM-DD string and return YYYY-MM-DD. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the end date for a duration preset.
 * Returns a YYYY-MM-DD string for fixed presets, or null for "ongoing".
 * The end date is inclusive -- the race covers start through end day,
 * ending at midnight UTC after the end day.
 */
export function computeEndDate(
  preset: string,
  startDate: string
): string | null {
  switch (preset) {
    case "1day":
      return startDate; // single calendar day
    case "2days":
      return addDays(startDate, 1);
    case "3days":
      return addDays(startDate, 2);
    case "1week":
      return addDays(startDate, 6);
    case "1quarter":
      return addDays(startDate, 89);
    case "ongoing":
      return null;
    default:
      return null;
  }
}

/** Map a period name to a {start, end} date range ending at today. */
export function periodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const endDate = today();
  switch (period) {
    case "day":
      return { start: endDate, end: endDate };
    case "week":
      return { start: weekStart(now), end: endDate };
    case "month":
      return { start: monthStart(now), end: endDate };
    case "yearly":
    default:
      return { start: yearStart(now), end: endDate };
  }
}
