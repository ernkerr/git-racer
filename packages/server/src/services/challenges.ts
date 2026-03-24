/**
 * Challenge creation service.
 *
 * Handles creating head-to-head or group commit challenges. Each challenge
 * gets a unique shareable slug (via nanoid) so participants can be invited
 * by link. Opponents are validated against the GitHub API before being added
 * as participants, and their commit data is pre-fetched in the background
 * so the leaderboard is populated by the time they open the link.
 */
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { challenges, challengeParticipants, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { SLUG_LENGTH } from "@git-racer/shared";
import type { CreateChallengeInput } from "@git-racer/shared";
import { validateGitHubUser } from "./github.js";
import { refreshCommitData } from "./commits.js";

/**
 * Create a new commit challenge and register all participants.
 *
 * Workflow:
 * 1. Validate every opponent username against the GitHub API.
 * 2. Look up whether each opponent already has a local user record (if not,
 *    they are marked as a "ghost" participant who can claim later).
 * 3. Insert the challenge row with a unique share slug.
 * 4. Register the creator and all opponents as participants.
 * 5. Fire-and-forget commit data pre-fetch for each opponent so the
 *    leaderboard has data ready when participants first view the challenge.
 *
 * @param input - Challenge metadata (name, type, duration) plus the creator's
 *                internal user ID and GitHub username.
 * @returns The generated share_slug for building the invite link.
 */
export async function createChallenge(
  input: CreateChallengeInput & { created_by: number; creator_username: string }
): Promise<{ share_slug: string }> {
  // Step 1: Validate all opponent usernames against the GitHub API in parallel.
  // Also check if they already have a local user record (for linking participation).
  const resolvedOpponents = await Promise.all(
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

  // Step 2: Generate a short, URL-safe slug for the shareable invite link
  const shareSlug = nanoid(SLUG_LENGTH);

  // Step 3: Insert the challenge record
  const [challenge] = await db
    .insert(challenges)
    .values({
      name: input.name,
      type: input.type,
      duration_type: input.duration_type,
      refresh_period: input.refresh_period ?? "weekly",
      start_date: new Date(),
      end_date: input.end_date ? new Date(input.end_date) : null,
      goal_target: input.goal_target ?? null,
      goal_metric: input.goal_metric ?? null,
      created_by: input.created_by,
      share_slug: shareSlug,
    })
    .returning({ id: challenges.id });

  // Step 4a: Register the challenge creator as the first participant
  await db.insert(challengeParticipants).values({
    challenge_id: challenge.id,
    user_id: input.created_by,
    github_username: input.creator_username,
    is_ghost: false,
  });

  // Step 4b: Register each opponent as a participant.
  // "Ghost" participants have no local user record yet -- they will be
  // linked to a real account when they sign up and open the challenge link.
  for (const opponent of resolvedOpponents) {
    await db.insert(challengeParticipants).values({
      challenge_id: challenge.id,
      user_id: opponent.user_id,
      github_username: opponent.github_username,
      is_ghost: opponent.is_ghost,
    });

    // Step 5: Pre-fetch commit history in the background so the leaderboard
    // has data ready immediately. Errors are swallowed -- missing data will
    // be filled in by the next scheduled sync.
    refreshCommitData(opponent.github_username).catch(() => {});
  }

  return { share_slug: shareSlug };
}
