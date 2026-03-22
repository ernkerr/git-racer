import { Hono } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { challenges, challengeParticipants, users } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { createChallengeSchema } from "@git-racer/shared";
import { createChallenge } from "../services/challenges.js";
import { refreshCommitData } from "../services/commits.js";
import type { AppEnv } from "../types.js";

export const challengeRoutes = new Hono<AppEnv>();

// Create a challenge
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

// Get challenge by slug (public)
challengeRoutes.get("/:slug", optionalAuth, async (c) => {
  const slug = c.req.param("slug");

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(eq(challenges.share_slug, slug))
    .limit(1);

  if (!challenge) return c.json({ error: "Challenge not found" }, 404);

  // Only refresh the logged-in user's data (not all participants)
  const authedUser = c.get("user") as { username?: string } | undefined;
  if (authedUser?.username) {
    try { await refreshCommitData(authedUser.username); } catch {}
  }

  const startDate = challenge.start_date.toISOString().slice(0, 10);
  const endDate = challenge.end_date
    ? challenge.end_date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Single query: participants + commit counts + avatars
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

  const leaderboard = rows.rows.map((r: any) => ({
    github_username: r.github_username,
    avatar_url: r.avatar_url,
    commit_count: Number(r.commit_count),
    is_ghost: r.is_ghost,
  }));

  return c.json({
    id: challenge.id,
    name: challenge.name,
    type: challenge.type,
    duration_type: challenge.duration_type,
    start_date: challenge.start_date.toISOString(),
    end_date: challenge.end_date?.toISOString() ?? null,
    goal_target: challenge.goal_target,
    goal_metric: challenge.goal_metric,
    created_by: challenge.created_by,
    share_slug: challenge.share_slug,
    created_at: challenge.created_at.toISOString(),
    participants: leaderboard,
  });
});

// Delete a challenge (creator only)
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

// Join a challenge
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
