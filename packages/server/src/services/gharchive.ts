/**
 * GH Archive ingestion service.
 *
 * Downloads hourly compressed JSON dumps from data.gharchive.org, extracts
 * PushEvent activity, and upserts per-user daily commit/push counts into the
 * `event_committers` table. Ingestion is resumable: each hour is tracked in
 * `seed_state` so that crashes or timeouts simply pick up where they left off.
 *
 * This is the primary backfill data source; real-time polling from the GitHub
 * Events API (see github-events.ts) supplements it for low-latency updates.
 */
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { db } from "../db/index.js";
import { eventCommitters, seedState } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { isBot, MAX_COMMITS_PER_PUSH } from "../lib/bot-filter.js";

/** Running totals accumulated per username while streaming an hourly archive file. */
interface CommitterAgg {
  avatar_url: string;
  push_count: number;
  commit_count: number;
}

/**
 * Extract commit count from PushEvent payload.
 * Capped at MAX_COMMITS_PER_PUSH to limit abuse.
 */
function getCommitCount(payload: any): number {
  let count = 1;
  if (typeof payload?.size === "number" && payload.size > 0) count = payload.size;
  else if (typeof payload?.distinct_size === "number" && payload.distinct_size > 0) count = payload.distinct_size;
  else if (Array.isArray(payload?.commits)) count = payload.commits.length || 1;
  return Math.min(count, MAX_COMMITS_PER_PUSH);
}

/**
 * Parse a single JSON line from the archive and merge it into the aggregation map.
 *
 * Each line is one GitHub event. We only care about PushEvents from non-bot
 * actors. Returns true if the line was a valid PushEvent that was counted.
 */
function processLine(line: string, agg: Map<string, CommitterAgg>): boolean {
  try {
    const event = JSON.parse(line);
    if (event.type !== "PushEvent") return false;

    const username: string = event.actor?.login;
    if (!username || isBot(username)) return false;

    const commitCount = getCommitCount(event.payload);

    // Merge into the running aggregation: increment if seen, otherwise initialize
    const existing = agg.get(username);
    if (existing) {
      existing.push_count += 1;
      existing.commit_count += commitCount;
    } else {
      agg.set(username, {
        avatar_url:
          event.actor.avatar_url ||
          `https://github.com/${username}.png`,
        push_count: 1,
        commit_count: commitCount,
      });
    }
    return true;
  } catch {
    // Malformed JSON lines are silently skipped; they are rare but expected
    return false;
  }
}

/**
 * Download, stream-decompress, and parse a single GH Archive hourly file.
 * Uses streaming to avoid buffering the full decompressed file (~400-800MB)
 * in memory. Only the aggregation map is held in memory (~few MB).
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

  if (!res.body) {
    throw new Error("Response body is null");
  }

  const agg = new Map<string, CommitterAgg>();
  let pushCount = 0;

  // Stream: fetch body → gunzip → readline (line-by-line parsing)
  const nodeStream = Readable.fromWeb(res.body as any);
  const gunzip = createGunzip();
  const rl = createInterface({ input: nodeStream.pipe(gunzip) });

  for await (const line of rl) {
    if (line && processLine(line, agg)) pushCount++;
  }

  console.log(
    `[gharchive] Parsed ${pushCount} PushEvents from ${agg.size} unique users`
  );
  return agg;
}

/**
 * Ingest GH Archive data for a given date.
 * Processes ONE hour per invocation to stay within serverless limits.
 * Tracks progress in seed_state so subsequent calls continue where we left off.
 *
 * Data writes and state updates are wrapped in a transaction so that
 * retries are idempotent — if the process crashes mid-write, nothing
 * persists and the hour will be re-processed cleanly on next run.
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

  // Recover the list of already-ingested hours from persisted state metadata
  const ingestedHours: number[] =
    state?.metadata &&
    typeof state.metadata === "object" &&
    "hours" in state.metadata
      ? (state.metadata as { hours: number[] }).hours
      : [];

  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  // GH Archive files are published with a ~1-2 hour delay, so for today
  // we cap at (current UTC hour - 2) to avoid 404s on unpublished files.
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

  const newHours = [...ingestedHours, targetHour];

  if (agg.size === 0) {
    await upsertState(stateKey, newHours);
    return {
      date,
      hour_ingested: targetHour,
      hours_done: newHours,
      total_users: 0,
    };
  }

  // Flatten the aggregation map into row objects for bulk upsert
  const rows = Array.from(agg.entries()).map(([username, data]) => ({
    github_username: username,
    avatar_url: data.avatar_url,
    date,
    commit_count: data.commit_count,
    push_count: data.push_count,
    last_seen_at: new Date(),
  }));

  // Wrap upserts + state update in a transaction for idempotency.
  // If the process crashes mid-write, the transaction rolls back and
  // the hour is NOT marked as ingested, so the next run retries cleanly.
  await db.transaction(async (tx) => {
    // Upsert in 500-row chunks to stay within Postgres parameter limits.
    // ON CONFLICT: add commit/push counts to any existing row for the same
    // (username, date) pair, so multiple hours accumulate correctly.
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await tx
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

    // Mark hour as ingested within the same transaction
    await tx
      .insert(seedState)
      .values({
        key: stateKey,
        last_run_at: new Date(),
        cursor: newHours.length,
        metadata: { hours: newHours },
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: sql`now()`,
          cursor: sql`${newHours.length}`,
          metadata: sql`${JSON.stringify({ hours: newHours })}::jsonb`,
          updated_at: sql`now()`,
        },
      });
  });

  return {
    date,
    hour_ingested: targetHour,
    hours_done: newHours,
    total_users: agg.size,
  };
}

/**
 * Persist ingestion progress for a date key, recording which hours have been processed.
 * Used when an hour yielded zero data (empty archive) so we can skip it on future runs.
 */
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
