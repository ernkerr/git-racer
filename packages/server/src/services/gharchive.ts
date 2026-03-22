import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { db } from "../db/index.js";
import { eventCommitters, seedState } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

interface PushEvent {
  type: string;
  actor: { login: string; avatar_url: string };
  payload: { size: number; distinct_size: number };
  created_at: string;
}

interface CommitterAgg {
  avatar_url: string;
  commit_count: number;
  push_count: number;
}

const BOT_PATTERNS = [
  /\[bot\]$/i,
  /-bot$/i,
  /^dependabot$/i,
  /^renovate$/i,
  /^github-actions$/i,
  /^greenkeeper$/i,
  /^snyk-bot$/i,
  /^codecov$/i,
  /^imgbot$/i,
  /^netlify$/i,
  /^vercel$/i,
];

function isBot(username: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(username));
}

/**
 * Download and parse a single GH Archive hourly file.
 * Returns aggregated commit counts per user.
 */
async function fetchHourlyArchive(
  date: string,
  hour: number
): Promise<Map<string, CommitterAgg>> {
  const url = `https://data.gharchive.org/${date}-${hour}.json.gz`;
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) {
      // File not published yet (GH Archive has ~1hr lag)
      return new Map();
    }
    throw new Error(`GH Archive fetch failed: ${res.status} ${url}`);
  }

  const agg = new Map<string, CommitterAgg>();
  const body = res.body;
  if (!body) return agg;

  const nodeStream = Readable.fromWeb(body as any);
  const gunzip = createGunzip();
  const rl = createInterface({ input: nodeStream.pipe(gunzip) });

  for await (const line of rl) {
    try {
      const event = JSON.parse(line);
      if (event.type !== "PushEvent") continue;

      const username: string = event.actor?.login;
      if (!username || isBot(username)) continue;

      const commits = event.payload?.distinct_size || event.payload?.size || 0;
      if (commits === 0) continue;

      const existing = agg.get(username);
      if (existing) {
        existing.commit_count += commits;
        existing.push_count += 1;
      } else {
        agg.set(username, {
          avatar_url: event.actor.avatar_url || `https://github.com/${username}.png`,
          commit_count: commits,
          push_count: 1,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return agg;
}

/**
 * Ingest available GH Archive hours for a given date.
 * Tracks which hours have been processed in seed_state.
 * Returns summary of what was ingested.
 */
export async function ingestGHArchive(dateStr?: string): Promise<{
  date: string;
  hours_ingested: number[];
  hours_skipped: number[];
  total_committers: number;
}> {
  const date = dateStr || new Date().toISOString().slice(0, 10);

  // Load state: which hours have we already ingested?
  const stateKey = `gharchive_${date}`;
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, stateKey))
    .limit(1);

  const ingestedHours: number[] =
    state?.metadata && typeof state.metadata === "object" && "hours" in state.metadata
      ? (state.metadata as { hours: number[] }).hours
      : [];

  const hoursIngested: number[] = [];
  const hoursSkipped: number[] = [];
  let totalNewCommitters = 0;

  // Determine current hour (don't try to fetch future hours)
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  // GH Archive has ~1-2hr lag, so skip the current and previous hour
  const maxHour = isToday ? Math.max(0, now.getUTCHours() - 2) : 23;

  for (let hour = 0; hour <= maxHour; hour++) {
    if (ingestedHours.includes(hour)) {
      hoursSkipped.push(hour);
      continue;
    }

    const agg = await fetchHourlyArchive(date, hour);
    if (agg.size === 0) {
      hoursSkipped.push(hour);
      continue;
    }

    // Upsert into event_committers
    const rows = Array.from(agg.entries()).map(([username, data]) => ({
      github_username: username,
      avatar_url: data.avatar_url,
      date,
      commit_count: data.commit_count,
      push_count: data.push_count,
      last_seen_at: new Date(),
    }));

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await db
        .insert(eventCommitters)
        .values(chunk)
        .onConflictDoUpdate({
          target: [eventCommitters.github_username, eventCommitters.date],
          set: {
            commit_count: sql`event_committers.commit_count + excluded.commit_count`,
            push_count: sql`event_committers.push_count + excluded.push_count`,
            avatar_url: sql`excluded.avatar_url`,
            last_seen_at: sql`excluded.last_seen_at`,
          },
        });
    }

    totalNewCommitters += agg.size;
    hoursIngested.push(hour);
    ingestedHours.push(hour);

    // Update state after each hour so we can resume
    await db
      .insert(seedState)
      .values({
        key: stateKey,
        last_run_at: new Date(),
        cursor: ingestedHours.length,
        metadata: { hours: ingestedHours },
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: sql`now()`,
          cursor: sql`${ingestedHours.length}`,
          metadata: sql`${JSON.stringify({ hours: ingestedHours })}::jsonb`,
          updated_at: sql`now()`,
        },
      });
  }

  return {
    date,
    hours_ingested: hoursIngested,
    hours_skipped: hoursSkipped,
    total_committers: totalNewCommitters,
  };
}
