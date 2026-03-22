import { gunzipSync } from "node:zlib";
import { db } from "../db/index.js";
import { eventCommitters, seedState } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

interface CommitterAgg {
  avatar_url: string;
  push_count: number;
  commit_count: number;
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
  /^copilot$/i,
  /^github-merge-queue$/i,
];

function isBot(username: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(username));
}

/**
 * Parse a PushEvent line from the buffer and accumulate into the map.
 * Extract commit count from PushEvent payload.
 * Tries payload.size, then payload.commits.length, falls back to 1.
 */
function getCommitCount(payload: any): number {
  if (typeof payload?.size === "number" && payload.size > 0) return payload.size;
  if (typeof payload?.distinct_size === "number" && payload.distinct_size > 0) return payload.distinct_size;
  if (Array.isArray(payload?.commits)) return payload.commits.length || 1;
  return 1;
}

function processLine(
  buf: Buffer,
  start: number,
  end: number,
  agg: Map<string, CommitterAgg>
): boolean {
  const line = buf.toString("utf-8", start, end);
  try {
    const event = JSON.parse(line);
    if (event.type !== "PushEvent") return false;

    const username: string = event.actor?.login;
    if (!username || isBot(username)) return false;

    const commits = getCommitCount(event.payload);

    const existing = agg.get(username);
    if (existing) {
      existing.push_count += 1;
      existing.commit_count += commits;
    } else {
      agg.set(username, {
        avatar_url:
          event.actor.avatar_url ||
          `https://github.com/${username}.png`,
        push_count: 1,
        commit_count: commits,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse decompressed NDJSON buffer line-by-line, counting pushes per user.
 */
function parsePushEvents(buf: Buffer): Map<string, CommitterAgg> {
  const agg = new Map<string, CommitterAgg>();
  let start = 0;
  let pushCount = 0;

  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== 10) continue;
    if (i > start) {
      if (processLine(buf, start, i, agg)) pushCount++;
    }
    start = i + 1;
  }

  // Handle last line without trailing newline
  if (start < buf.length) {
    if (processLine(buf, start, buf.length, agg)) pushCount++;
  }

  console.log(
    `[gharchive] Parsed ${pushCount} PushEvents from ${agg.size} unique users`
  );
  return agg;
}

/**
 * Download, decompress, and parse a single GH Archive hourly file.
 */
async function fetchHourlyArchive(
  date: string,
  hour: number
): Promise<Map<string, CommitterAgg>> {
  const url = `https://data.gharchive.org/${date}-${hour}.json.gz`;
  console.log(`[gharchive] Fetching ${url}`);

  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) {
      console.log(`[gharchive] 404 — not published yet`);
      return new Map();
    }
    throw new Error(`GH Archive fetch failed: ${res.status} ${url}`);
  }

  const gzipped = Buffer.from(await res.arrayBuffer());
  console.log(
    `[gharchive] Downloaded ${(gzipped.length / 1024 / 1024).toFixed(1)}MB`
  );

  const decompressed = gunzipSync(gzipped);
  console.log(
    `[gharchive] Decompressed ${(decompressed.length / 1024 / 1024).toFixed(1)}MB`
  );

  return parsePushEvents(decompressed);
}

/**
 * Ingest GH Archive data for a given date.
 * Processes ONE hour per invocation to stay within serverless limits.
 * Tracks progress in seed_state so subsequent calls continue where we left off.
 *
 * commit_count = push_count (each push = 1 unit of activity)
 * since GH Archive no longer includes per-push commit counts.
 */
export async function ingestGHArchive(dateStr?: string): Promise<{
  date: string;
  hour_ingested: number | null;
  hours_done: number[];
  total_users: number;
  error?: string;
}> {
  const date = dateStr || new Date().toISOString().slice(0, 10);

  const stateKey = `gharchive_${date}`;
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, stateKey))
    .limit(1);

  const ingestedHours: number[] =
    state?.metadata &&
    typeof state.metadata === "object" &&
    "hours" in state.metadata
      ? (state.metadata as { hours: number[] }).hours
      : [];

  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const maxHour = isToday ? Math.max(0, now.getUTCHours() - 2) : 23;

  // Find the next hour to process
  let targetHour: number | null = null;
  for (let h = 0; h <= maxHour; h++) {
    if (!ingestedHours.includes(h)) {
      targetHour = h;
      break;
    }
  }

  if (targetHour === null) {
    return {
      date,
      hour_ingested: null,
      hours_done: ingestedHours,
      total_users: 0,
    };
  }

  let agg: Map<string, CommitterAgg>;
  try {
    agg = await fetchHourlyArchive(date, targetHour);
  } catch (err: any) {
    console.error(`[gharchive] Error fetching hour ${targetHour}:`, err);
    return {
      date,
      hour_ingested: targetHour,
      hours_done: ingestedHours,
      total_users: 0,
      error: err.message,
    };
  }

  if (agg.size === 0) {
    ingestedHours.push(targetHour);
    await upsertState(stateKey, ingestedHours);
    return {
      date,
      hour_ingested: targetHour,
      hours_done: ingestedHours,
      total_users: 0,
    };
  }

  // Upsert into event_committers
  // Use push_count for both commit_count and push_count since
  // GH Archive doesn't provide per-push commit counts
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

  ingestedHours.push(targetHour);
  await upsertState(stateKey, ingestedHours);

  return {
    date,
    hour_ingested: targetHour,
    hours_done: ingestedHours,
    total_users: agg.size,
  };
}

async function upsertState(stateKey: string, hours: number[]) {
  await db
    .insert(seedState)
    .values({
      key: stateKey,
      last_run_at: new Date(),
      cursor: hours.length,
      metadata: { hours },
    })
    .onConflictDoUpdate({
      target: seedState.key,
      set: {
        last_run_at: sql`now()`,
        cursor: sql`${hours.length}`,
        metadata: sql`${JSON.stringify({ hours })}::jsonb`,
        updated_at: sql`now()`,
      },
    });
}
