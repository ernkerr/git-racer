/** Get Monday of the week containing `d`, as YYYY-MM-DD */
export function weekStart(d: Date = new Date()): string {
  const day = d.getDay() || 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - day + 1);
  return mon.toISOString().slice(0, 10);
}

/** Get Sunday of the week containing `d`, as YYYY-MM-DD */
export function weekEnd(d: Date = new Date()): string {
  const day = d.getDay() || 7;
  const sun = new Date(d);
  sun.setDate(d.getDate() - day + 7);
  return sun.toISOString().slice(0, 10);
}

/** First day of the month, as YYYY-MM-DD */
export function monthStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Jan 1 of the year, as YYYY-MM-DD */
export function yearStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-01-01`;
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Yesterday as YYYY-MM-DD */
export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** ISO week number */
export function isoWeek(d: Date = new Date()): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/** Date range for a period string */
export function periodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = today();
  switch (period) {
    case "day":
      return { start: today(), end: today() };
    case "week":
      return { start: weekStart(now), end };
    case "month":
      return { start: monthStart(now), end };
    case "yearly":
    default:
      return { start: yearStart(now), end };
  }
}
