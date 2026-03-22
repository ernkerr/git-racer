/**
 * Real-time GitHub Events API polling service.
 *
 * Supplements the GH Archive backfill (gharchive.ts) by polling the public
 * events timeline for recent PushEvents. This provides low-latency commit
 * data (seconds-old) compared to GH Archive's ~1-2 hour publication delay.
 *
 * Uses HTTP ETags for conditional requests so that 304 responses do not
 * consume rate-limit quota. Deduplicates events via a persisted set of
 * recently-seen event IDs (trimmed to the last 5000 to bound storage).
 */
import { env } from "../lib/env.js";
import { db } from "../db/index.js";
import { eventCommitters, seedState } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { isBot, MAX_COMMITS_PER_PUSH } from "../lib/bot-filter.js";

/** Shape of a PushEvent from the GitHub public events API. */
interface PushEvent {
  id: string;
  type: string;
  actor: { login: string; avatar_url: string };
  payload: { size?: number; distinct_size?: number; commits?: unknown[] };
  created_at: string;
}

/**
 * Intermediate result from polling the events API.
 * State (etag + seen_ids) is returned but NOT persisted here -- the caller
 * saves it atomically alongside data upserts to prevent double-counting.
 */
interface PollResult {
  users: Map<string, { avatar_url: string; commit_count: number }>;
  events_processed: number;
  new_data: boolean;
  stateToSave: { etag: string | null; seen_ids: string[] };
}

/**
 * Poll the GitHub public events timeline for PushEvents.
 * Returns commit counts per user from recent events.
 * Uses ETags for conditional requests (304 = no new data, doesn't count against rate limit).
 *
 * State (etag, seen_ids) is returned but NOT saved here — the caller
 * saves it atomically with the data upserts to prevent double-counting.
 */
async function pollGitHubEvents(): Promise<PollResult> {
  const token = env.GITHUB_APP_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const stateKey = "github_events_poll";
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, stateKey))
    .limit(1);

  // Recover persisted polling state: the HTTP ETag (for conditional requests)
  // and a set of already-processed event IDs (for deduplication).
  const lastEtag =
    state?.metadata && typeof state.metadata === "object" && "etag" in state.metadata
      ? (state.metadata as { etag: string }).etag
      : null;
  const previouslySeenIds =
    state?.metadata && typeof state.metadata === "object" && "seen_ids" in state.metadata
      ? new Set((state.metadata as { seen_ids: string[] }).seen_ids)
      : new Set<string>();

  // Conditional request: if the timeline hasn't changed, GitHub returns 304
  // without consuming rate-limit quota.
  if (lastEtag) {
    headers["If-None-Match"] = lastEtag;
  }

  const commitsByUser = new Map<string, { avatar_url: string; commit_count: number }>();
  let eventsProcessed = 0;
  let newEtag = lastEtag;
  const freshSeenIds = new Set<string>();

  // Paginate through the public timeline (up to 3 pages / 300 events).
  // The API returns events newest-first across all of GitHub, not just our users.
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/events?per_page=100&page=${page}`,
      { headers }
    );

    if (res.status === 304) {
      // No new events since last poll -- return early, preserving existing state
      return {
        users: commitsByUser,
        events_processed: 0,
        new_data: false,
        stateToSave: { etag: lastEtag, seen_ids: [...previouslySeenIds] },
      };
    }

    if (!res.ok) {
      console.log(`[events] GitHub Events API returned ${res.status}`);
      break;
    }

    // Capture the ETag from the first page only (subsequent pages have different ETags)
    if (page === 1) {
      newEtag = res.headers.get("etag") || lastEtag;
    }

    const events = (await res.json()) as PushEvent[];

    for (const event of events) {
      if (event.type !== "PushEvent") continue;
      // Skip events we already processed in a previous poll cycle
      if (previouslySeenIds.has(event.id) || freshSeenIds.has(event.id)) continue;

      freshSeenIds.add(event.id);

      const username = event.actor?.login;
      if (!username || isBot(username)) continue;

      // Prefer payload.size (total commits), fall back to distinct_size or array length
      const rawCommitCount =
        event.payload?.size ||
        event.payload?.distinct_size ||
        event.payload?.commits?.length ||
        1;
      const cappedCommitCount = Math.min(rawCommitCount, MAX_COMMITS_PER_PUSH);

      eventsProcessed++;
      const existing = commitsByUser.get(username);
      if (existing) {
        existing.commit_count += cappedCommitCount;
      } else {
        commitsByUser.set(username, {
          avatar_url: event.actor.avatar_url || `https://github.com/${username}.png`,
          commit_count: cappedCommitCount,
        });
      }
    }
  }

  // Merge old + new seen IDs, then trim to the most recent 5000 to prevent
  // unbounded growth while still deduplicating across consecutive poll cycles.
  const allSeenIds = [...previouslySeenIds, ...freshSeenIds];
  const trimmedSeenIds = allSeenIds.slice(-5000);

  return {
    users: commitsByUser,
    events_processed: eventsProcessed,
    new_data: eventsProcessed > 0,
    stateToSave: { etag: newEtag, seen_ids: trimmedSeenIds },
  };
}

/**
 * Poll the GitHub public events API and upsert discovered PushEvent data
 * into `event_committers`.
 *
 * Data upserts and polling-state persistence are wrapped in a single
 * transaction so that retries are idempotent: if the process crashes
 * mid-write, seen_ids are not persisted and the same events will be
 * correctly deduplicated on the next run.
 *
 * @returns Summary of what was ingested, suitable for logging or API response.
 */
export async function ingestRealtimeEvents(): Promise<{
  events_processed: number;
  users_upserted: number;
  new_data: boolean;
}> {
  const { users, events_processed, new_data, stateToSave } = await pollGitHubEvents();

  if (!new_data || users.size === 0) {
    // Still save state (etag) even when no new data so the next poll
    // can send a conditional request, but no transaction needed.
    await db
      .insert(seedState)
      .values({
        key: "github_events_poll",
        last_run_at: new Date(),
        cursor: 0,
        metadata: stateToSave,
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: sql`now()`,
          metadata: sql`${JSON.stringify(stateToSave)}::jsonb`,
          updated_at: sql`now()`,
        },
      });
    return { events_processed: 0, users_upserted: 0, new_data: false };
  }

  // Flatten the per-user map into row objects keyed to today's date
  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.from(users.entries()).map(([username, data]) => ({
    github_username: username,
    avatar_url: data.avatar_url,
    date: today,
    commit_count: data.commit_count,
    push_count: 1,
    last_seen_at: new Date(),
  }));

  // Wrap upserts + state save in a single transaction for idempotency.
  // If the process crashes, the transaction rolls back, seen_ids are not
  // persisted, and the next run will re-process the same events safely.
  await db.transaction(async (tx) => {
    // Upsert in 500-row chunks to stay within Postgres parameter limits.
    // ON CONFLICT: accumulate counts so real-time data supplements archive data.
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

    // Persist polling state (etag + seen_ids) within the same transaction
    await tx
      .insert(seedState)
      .values({
        key: "github_events_poll",
        last_run_at: new Date(),
        cursor: 0,
        metadata: stateToSave,
      })
      .onConflictDoUpdate({
        target: seedState.key,
        set: {
          last_run_at: sql`now()`,
          metadata: sql`${JSON.stringify(stateToSave)}::jsonb`,
          updated_at: sql`now()`,
        },
      });
  });

  return {
    events_processed,
    users_upserted: users.size,
    new_data: true,
  };
}
