import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { challenges, challengeParticipants, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { SLUG_LENGTH } from "@git-racer/shared";
import type { CreateChallengeInput } from "@git-racer/shared";
import { validateGitHubUser } from "./github.js";
import { refreshCommitData } from "./commits.js";

export async function createChallenge(
  input: CreateChallengeInput & { created_by: number; creator_username: string }
): Promise<{ share_slug: string }> {
  // Validate all opponents exist on GitHub
  const resolved = await Promise.all(
    input.opponents.map(async (username) => {
      const ghUser = await validateGitHubUser(username);
      if (!ghUser) throw new Error(`GitHub user "${username}" not found`);

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.github_username, ghUser.login))
        .limit(1);

      return {
        github_username: ghUser.login,
        user_id: existing?.id ?? null,
        is_ghost: !existing,
      };
    })
  );

  const shareSlug = nanoid(SLUG_LENGTH);

  const [challenge] = await db
    .insert(challenges)
    .values({
      name: input.name,
      type: input.type,
      duration_type: input.duration_type,
      start_date: new Date(),
      end_date: input.end_date ? new Date(input.end_date) : null,
      goal_target: input.goal_target ?? null,
      goal_metric: input.goal_metric ?? null,
      created_by: input.created_by,
      share_slug: shareSlug,
    })
    .returning({ id: challenges.id });

  // Add creator as participant
  await db.insert(challengeParticipants).values({
    challenge_id: challenge.id,
    user_id: input.created_by,
    github_username: input.creator_username,
    is_ghost: false,
  });

  // Add all opponents as participants
  for (const opponent of resolved) {
    await db.insert(challengeParticipants).values({
      challenge_id: challenge.id,
      user_id: opponent.user_id,
      github_username: opponent.github_username,
      is_ghost: opponent.is_ghost,
    });

    // Pre-fetch commit data (non-blocking)
    refreshCommitData(opponent.github_username).catch(() => {});
  }

  return { share_slug: shareSlug };
}
