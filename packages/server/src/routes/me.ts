import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users, challenges, challengeParticipants } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { getUserStats, getCommitCount } from "../services/commits.js";
import type { AppEnv } from "../types.js";

export const meRoutes = new Hono<AppEnv>();

meRoutes.use("*", requireAuth);

meRoutes.get("/", async (c) => {
  const { sub: userId } = c.get("user");

  const [user] = await db
    .select({
      id: users.id,
      github_id: users.github_id,
      github_username: users.github_username,
      avatar_url: users.avatar_url,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

meRoutes.get("/stats", async (c) => {
  const { sub: userId } = c.get("user");

  const [user] = await db
    .select({
      github_username: users.github_username,
      access_token: users.access_token,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  const stats = await getUserStats(user.github_username, user.access_token);
  return c.json(stats);
});

meRoutes.get("/challenges", async (c) => {
  const { sub: userId, username } = c.get("user");

  // Get all challenges where the user is a participant
  const rows = await db
    .select({
      id: challenges.id,
      name: challenges.name,
      type: challenges.type,
      share_slug: challenges.share_slug,
      end_date: challenges.end_date,
      start_date: challenges.start_date,
    })
    .from(challenges)
    .innerJoin(
      challengeParticipants,
      eq(challenges.id, challengeParticipants.challenge_id)
    )
    .where(eq(challengeParticipants.github_username, username))
    .orderBy(desc(challenges.created_at));

  // For each challenge, get participant count and leader
  const result = await Promise.all(
    rows.map(async (challenge) => {
      const participants = await db
        .select({
          github_username: challengeParticipants.github_username,
        })
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challenge_id, challenge.id));

      // Get commit counts for each participant within the challenge period
      const startDate = challenge.start_date.toISOString().slice(0, 10);
      const endDate = challenge.end_date
        ? challenge.end_date.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const counts = await Promise.all(
        participants.map(async (p) => ({
          username: p.github_username,
          commits: await getCommitCount(p.github_username, startDate, endDate),
        }))
      );

      counts.sort((a, b) => b.commits - a.commits);
      const myCommits = counts.find((c) => c.username === username)?.commits ?? 0;

      return {
        id: challenge.id,
        name: challenge.name,
        type: challenge.type,
        share_slug: challenge.share_slug,
        end_date: challenge.end_date?.toISOString() ?? null,
        your_commits: myCommits,
        leader_username: counts[0]?.username ?? "",
        leader_commits: counts[0]?.commits ?? 0,
        participant_count: participants.length,
      };
    })
  );

  return c.json(result);
});
