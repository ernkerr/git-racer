/**
 * Challenge routes -- CRUD operations for race challenges.
 *
 * Challenges are time-boxed commit races between GitHub users. They come in
 * two flavors: 1v1 (invite-only) and team (joinable via a share link).
 * Each challenge has a unique share_slug used for public URLs.
 *
 * Endpoints:
 *   POST   /             Create a new challenge
 *   GET    /:slug        Get challenge details + leaderboard (public)
 *   PATCH  /:slug        Update challenge settings (creator only)
 *   DELETE /:slug        Delete a challenge (creator only)
 *   POST   /:slug/join   Join a team challenge
 */
import { Hono } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { challenges, challengeParticipants, users } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { createChallengeSchema } from "@git-racer/shared";
import { createChallenge, finalizeChallenge } from "../services/challenges.js";
import { refreshCommitData } from "../services/commits.js";
import { today } from "../lib/dates.js";
import type { AppEnv } from "../types.js";

export const challengeRoutes = new Hono<AppEnv>();

/** Create a new challenge. Validates input via Zod schema and delegates to the challenge service. */
challengeRoutes.post("/", requireAuth, async (c) => {
  const { sub: userId, username } = c.get("user");
  const body = await c.req.json();

  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  try {
    const result = await createChallenge({
      ...parsed.data,
      created_by: userId,
      creator_username: username,
    });
    return c.json(result, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create challenge";
    return c.json({ error: message }, 400);
  }
});

/**
 * Get challenge details and leaderboard by share slug.
 * Publicly accessible; if the viewer is logged in, their commit data is refreshed first.
 */
challengeRoutes.get("/:slug", optionalAuth, async (c) => {
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) return c.json({ error: "Challenge not found" }, 404);

  const isFinished = challenge.end_date ? challenge.end_date < new Date() : false;

  // If the race is finished but not finalized, finalize it now (lazy finalization).
  if (isFinished && !challenge.is_finalized) {
    await finalizeChallenge(challenge.id);
    // Re-fetch challenge to get the frozen final_results
    const [updated] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challenge.id))
      .limit(1);
    if (updated) Object.assign(challenge, updated);
  }

  // Build response from finalized results or live data
  let leaderboard: { github_username: string; avatar_url: string; commit_count: number; is_ghost: boolean }[];
  let daily: Record<string, { date: string; count: number }[]> = {};

  const startDate = challenge.start_date.toISOString().slice(0, 10);
  const todayStr = today();
  const endDate = challenge.end_date
    ? challenge.end_date.toISOString().slice(0, 10)
    : todayStr;

  if (challenge.is_finalized && challenge.final_results) {
    // Use frozen results -- no refresh, no live queries
    const participantRows = await db
      .select()
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challenge_id, challenge.id));

    const participantMap = new Map(participantRows.map((p) => [p.github_username, p]));

    // Look up avatars for finalized results
    const userRows = await db
      .select({ github_username: users.github_username, avatar_url: users.avatar_url })
      .from(users)
      .where(sql`github_username = ANY(${(challenge.final_results as any[]).map((r: any) => r.github_username)})`);
    const avatarMap = new Map(userRows.map((u) => [u.github_username, u.avatar_url]));

    leaderboard = (challenge.final_results as any[]).map((r: any) => ({
      github_username: r.github_username,
      avatar_url: avatarMap.get(r.github_username) || `https://github.com/${r.github_username}.png`,
      commit_count: r.commit_count,
      is_ghost: participantMap.get(r.github_username)?.is_ghost ?? false,
    }));

    // Per-day breakdown still comes from commit_snapshots (for the Race Path chart)
    const dailyRows = await db.execute(sql`
      SELECT cs.github_username, cs.date, cs.commit_count
      FROM commit_snapshots cs
      INNER JOIN challenge_participants cp
        ON cp.github_username = cs.github_username
        AND cp.challenge_id = ${challenge.id}
      WHERE cs.date >= ${startDate}
        AND cs.date <= ${endDate}
      ORDER BY cs.github_username, cs.date ASC
    `);

    for (const r of dailyRows.rows as any[]) {
      const u = r.github_username as string;
      if (!daily[u]) daily[u] = [];
      daily[u].push({ date: r.date, count: Number(r.commit_count) });
    }
  } else {
    // Live race: fire-and-forget refresh for all participants
    const participantRows = await db
      .select({ github_username: challengeParticipants.github_username })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challenge_id, challenge.id));

    Promise.all(
      participantRows.map((p) =>
        refreshCommitData(p.github_username).catch((err) =>
          console.error("[refresh]", p.github_username, err.message)
        )
      )
    );

    const rows = await db.execute(sql`
      SELECT
        cp.github_username,
        cp.is_ghost,
        COALESCE(SUM(cs.commit_count), 0)::int AS commit_count,
        COALESCE(u.avatar_url, 'https://github.com/' || cp.github_username || '.png') AS avatar_url
      FROM challenge_participants cp
      LEFT JOIN commit_snapshots cs
        ON cs.github_username = cp.github_username
        AND cs.date >= ${startDate}
        AND cs.date <= ${endDate}
      LEFT JOIN users u ON u.id = cp.user_id
      WHERE cp.challenge_id = ${challenge.id}
      GROUP BY cp.github_username, cp.is_ghost, u.avatar_url
      ORDER BY commit_count DESC
    `);

    leaderboard = rows.rows.map((r: any) => ({
      github_username: r.github_username,
      avatar_url: r.avatar_url,
      commit_count: Number(r.commit_count),
      is_ghost: r.is_ghost,
    }));

    const dailyRows = await db.execute(sql`
      SELECT cs.github_username, cs.date, cs.commit_count
      FROM commit_snapshots cs
      INNER JOIN challenge_participants cp
        ON cp.github_username = cs.github_username
        AND cp.challenge_id = ${challenge.id}
      WHERE cs.date >= ${startDate}
        AND cs.date <= ${endDate}
      ORDER BY cs.github_username, cs.date ASC
    `);

    for (const r of dailyRows.rows as any[]) {
      const u = r.github_username as string;
      if (!daily[u]) daily[u] = [];
      daily[u].push({ date: r.date, count: Number(r.commit_count) });
    }
  }

  const race_stats = {
    total_commits: leaderboard.reduce((sum, p) => sum + p.commit_count, 0),
    participant_count: leaderboard.length,
  };

  c.header("Cache-Control", challenge.is_finalized ? "public, max-age=86400" : "public, max-age=60");
  return c.json({
    id: challenge.id,
    name: challenge.name,
    type: challenge.type,
    duration_type: challenge.duration_type,
    duration_preset: challenge.duration_preset,
    include_today: challenge.include_today,
    start_date: challenge.start_date.toISOString(),
    end_date: challenge.end_date?.toISOString() ?? null,
    goal_target: challenge.goal_target,
    goal_metric: challenge.goal_metric,
    created_by: challenge.created_by,
    share_slug: challenge.share_slug,
    created_at: challenge.created_at.toISOString(),
    is_finalized: challenge.is_finalized,
    participants: leaderboard,
    daily,
    race_stats,
  });
});

/** Update challenge settings (name, end date). Restricted to the challenge creator. */
challengeRoutes.patch("/:slug", requireAuth, async (c) => {
  const { sub: userId } = c.get("user");
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) return c.json({ error: "Challenge not found" }, 404);
  if (challenge.created_by !== userId) {
    return c.json({ error: "Only the creator can update this race" }, 403);
  }
  if (challenge.is_finalized) {
    return c.json({ error: "Cannot update a finalized race" }, 400);
  }

  const body = await c.req.json();
  // Build a partial update object from the allowed mutable fields
  const updates: Record<string, unknown> = {};

  if (body.end_date !== undefined) {
    updates.end_date = body.end_date ? new Date(body.end_date) : null;
  }
  if (body.name !== undefined) {
    updates.name = body.name;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(challenges)
      .set(updates)
      .where(eq(challenges.id, challenge.id));
  }

  return c.json({ ok: true });
});

/** Delete a challenge and all its participants. Restricted to the challenge creator. */
challengeRoutes.delete("/:slug", requireAuth, async (c) => {
  const { sub: userId } = c.get("user");
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) return c.json({ error: "Challenge not found" }, 404);
  if (challenge.created_by !== userId) {
    return c.json({ error: "Only the creator can delete this race" }, 403);
  }

  // Delete participants first (FK constraint), then the challenge itself
  await db.transaction(async (tx) => {
    await tx
      .delete(challengeParticipants)
      .where(eq(challengeParticipants.challenge_id, challenge.id));
    await tx
      .delete(challenges)
      .where(eq(challenges.id, challenge.id));
  });

  return c.json({ ok: true });
});

/** Join an existing team challenge via its share link. 1v1 challenges cannot be joined this way. */
challengeRoutes.post("/:slug/join", requireAuth, async (c) => {
  const { sub: userId, username } = c.get("user");
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) return c.json({ error: "Challenge not found" }, 404);

  // Only team challenges allow join via link
  if (challenge.type === "1v1") {
    return c.json({ error: "Cannot join a 1v1 challenge" }, 403);
  }

  // Check if already a participant
  const existing = await db
    .select()
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challenge_id, challenge.id));

  if (existing.some((p) => p.github_username === username)) {
    return c.json({ error: "Already in this challenge" }, 400);
  }

  await db.insert(challengeParticipants).values({
    challenge_id: challenge.id,
    user_id: userId,
    github_username: username,
    is_ghost: false,
  });

  return c.json({ ok: true }, 201);
});

/**
 * Get head-to-head record between the current user and another user.
 * Looks at all finalized 1v1 challenges where both users are participants.
 */
challengeRoutes.get("/h2h/:username", requireAuth, async (c) => {
  const { username: myUsername } = c.get("user");
  const theirUsername = c.req.param("username");

  // Find all finalized 1v1 challenges where both users are participants
  const rows = await db.execute(sql`
    SELECT
      c.share_slug,
      c.name,
      c.end_date,
      c.final_results
    FROM challenges c
    WHERE c.type = '1v1'
      AND c.is_finalized = true
      AND EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = c.id AND cp.github_username = ${myUsername}
      )
      AND EXISTS (
        SELECT 1 FROM challenge_participants cp
        WHERE cp.challenge_id = c.id AND cp.github_username = ${theirUsername}
      )
    ORDER BY c.end_date DESC
  `);

  let wins = 0;
  let losses = 0;
  let ties = 0;
  const races: { share_slug: string; name: string; your_count: number; their_count: number; end_date: string }[] = [];

  for (const r of rows.rows as any[]) {
    const results = r.final_results as { github_username: string; commit_count: number }[];
    const myResult = results.find((p) => p.github_username === myUsername);
    const theirResult = results.find((p) => p.github_username === theirUsername);
    const myCount = myResult?.commit_count ?? 0;
    const theirCount = theirResult?.commit_count ?? 0;

    if (myCount > theirCount) wins++;
    else if (myCount < theirCount) losses++;
    else ties++;

    races.push({
      share_slug: r.share_slug,
      name: r.name,
      your_count: myCount,
      their_count: theirCount,
      end_date: r.end_date?.toISOString?.() ?? r.end_date,
    });
  }

  return c.json({ wins, losses, ties, races });
});
