import { Hono } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { challenges, challengeParticipants, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createChallengeSchema } from "@git-racer/shared";
import { createChallenge } from "../services/challenges.js";
import { getCommitCount, refreshCommitData } from "../services/commits.js";
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

  // Get participants
  const participants = await db
    .select({
      github_username: challengeParticipants.github_username,
      is_ghost: challengeParticipants.is_ghost,
      user_id: challengeParticipants.user_id,
    })
    .from(challengeParticipants)
    .where(eq(challengeParticipants.challenge_id, challenge.id));

  // Refresh and get commit counts for each participant
  const startDate = challenge.start_date.toISOString().slice(0, 10);
  const endDate = challenge.end_date
    ? challenge.end_date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const leaderboard = await Promise.all(
    participants.map(async (p) => {
      await refreshCommitData(p.github_username);

      // Get avatar URL
      let avatarUrl: string | null = null;
      if (p.user_id) {
        const [user] = await db
          .select({ avatar_url: users.avatar_url })
          .from(users)
          .where(eq(users.id, p.user_id))
          .limit(1);
        avatarUrl = user?.avatar_url ?? null;
      } else {
        avatarUrl = `https://github.com/${p.github_username}.png`;
      }

      const commitCount = await getCommitCount(
        p.github_username,
        startDate,
        endDate
      );

      return {
        github_username: p.github_username,
        avatar_url: avatarUrl,
        commit_count: commitCount,
        is_ghost: p.is_ghost,
      };
    })
  );

  leaderboard.sort((a, b) => b.commit_count - a.commit_count);

  return c.json({
    id: challenge.id,
    name: challenge.name,
    type: challenge.type,
    duration_type: challenge.duration_type,
    start_date: challenge.start_date.toISOString(),
    end_date: challenge.end_date?.toISOString() ?? null,
    goal_target: challenge.goal_target,
    goal_metric: challenge.goal_metric,
    share_slug: challenge.share_slug,
    created_at: challenge.created_at.toISOString(),
    participants: leaderboard,
  });
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
