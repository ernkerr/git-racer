import { env } from "../lib/env.js";
import { db } from "../db/index.js";
import { eventCommitters, seedState } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";

interface PushEvent {
  id: string;
  type: string;
  actor: { login: string; avatar_url: string };
  payload: { size?: number; distinct_size?: number; commits?: unknown[] };
  created_at: string;
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
 * Poll the GitHub public events timeline for PushEvents.
 * Returns commit counts per user from recent events.
 * Uses ETags for conditional requests (304 = no new data, doesn't count against rate limit).
 */
export async function pollGitHubEvents(): Promise<{
  users: Map<string, { avatar_url: string; commit_count: number }>;
  events_processed: number;
  new_data: boolean;
}> {
  const token = env.GITHUB_APP_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Load ETag from state
  const stateKey = "github_events_poll";
  const [state] = await db
    .select()
    .from(seedState)
    .where(eq(seedState.key, stateKey))
    .limit(1);

  const lastEtag =
    state?.metadata && typeof state.metadata === "object" && "etag" in state.metadata
      ? (state.metadata as { etag: string }).etag
      : null;
  const seenIds =
    state?.metadata && typeof state.metadata === "object" && "seen_ids" in state.metadata
      ? new Set((state.metadata as { seen_ids: string[] }).seen_ids)
      : new Set<string>();

  if (lastEtag) {
    headers["If-None-Match"] = lastEtag;
  }

  const users = new Map<string, { avatar_url: string; commit_count: number }>();
  let eventsProcessed = 0;
  let newEtag = lastEtag;
  const newSeenIds = new Set<string>();

  // Fetch up to 3 pages (300 events)
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/events?per_page=100&page=${page}`,
      { headers }
    );

    if (res.status === 304) {
      return { users, events_processed: 0, new_data: false };
    }

    if (!res.ok) {
      console.log(`[events] GitHub Events API returned ${res.status}`);
      break;
    }

    if (page === 1) {
      newEtag = res.headers.get("etag") || lastEtag;
    }

    const events = (await res.json()) as PushEvent[];

    for (const event of events) {
      if (event.type !== "PushEvent") continue;
      if (seenIds.has(event.id) || newSeenIds.has(event.id)) continue;

      newSeenIds.add(event.id);

      const username = event.actor?.login;
      if (!username || isBot(username)) continue;

      // Get actual commit count from the event payload
      const commits =
        event.payload?.size ||
        event.payload?.distinct_size ||
        event.payload?.commits?.length ||
        1;

      eventsProcessed++;
      const existing = users.get(username);
      if (existing) {
        existing.commit_count += commits;
      } else {
        users.set(username, {
          avatar_url: event.actor.avatar_url || `https://github.com/${username}.png`,
          commit_count: commits,
        });
      }
    }
  }

  // Keep only last 5000 seen IDs to prevent unbounded growth
  const allSeen = [...seenIds, ...newSeenIds];
  const trimmedSeen = allSeen.slice(-5000);

  // Save state
  await db
    .insert(seedState)
    .values({
      key: stateKey,
      last_run_at: new Date(),
      cursor: 0,
      metadata: { etag: newEtag, seen_ids: trimmedSeen },
    })
    .onConflictDoUpdate({
      target: seedState.key,
      set: {
        last_run_at: sql`now()`,
        metadata: sql`${JSON.stringify({ etag: newEtag, seen_ids: trimmedSeen })}::jsonb`,
        updated_at: sql`now()`,
      },
    });

  return { users, events_processed: eventsProcessed, new_data: eventsProcessed > 0 };
}

/**
 * Poll GitHub Events API and upsert results into event_committers.
 * Uses GREATEST to avoid overwriting GH Archive data with lower counts.
 */
export async function ingestRealtimeEvents(): Promise<{
  events_processed: number;
  users_upserted: number;
  new_data: boolean;
}> {
  const { users, events_processed, new_data } = await pollGitHubEvents();

  if (!new_data || users.size === 0) {
    return { events_processed: 0, users_upserted: 0, new_data: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.from(users.entries()).map(([username, data]) => ({
    github_username: username,
    avatar_url: data.avatar_url,
    date: today,
    commit_count: data.commit_count,
    push_count: 1,
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
          // Add to existing count (real-time supplements archive data)
          commit_count: sql`event_committers.commit_count + excluded.commit_count`,
          push_count: sql`event_committers.push_count + excluded.push_count`,
          avatar_url: sql`excluded.avatar_url`,
          last_seen_at: sql`excluded.last_seen_at`,
        },
      });
  }

  return {
    events_processed,
    users_upserted: users.size,
    new_data: true,
  };
}
