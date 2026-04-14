/**
 * League Service
 *
 * Manages weekly competitive leagues that group users into tiered brackets
 * (bronze -> silver -> gold -> platinum -> diamond). Each week, every active
 * user is placed into a group of up to 30 members within their current tier.
 * Groups are populated with "ghost" opponents drawn from a pool of tracked
 * GitHub users whose commit activity is similar to the real user's.
 *
 * At the end of the week, members are ranked by commit count within their
 * group. The top 5 are promoted to the next tier; the bottom 5 are demoted.
 * Everyone else stays in their current tier for the following week.
 *
 * Key concepts:
 * - Tiers:  bronze | silver | gold | platinum | diamond
 * - Groups: up to LEAGUE_GROUP_SIZE (30) members per group within a tier
 * - Ghost members: pool users inserted with user_id = null so real users
 *   always have a full leaderboard to compete against
 * - Lazy assignment: league membership is created on first access each week
 */
import { db } from "../db/index.js";
import {
  leagueMemberships,
  commitSnapshots,
  suggestedOpponents,
} from "../db/schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import {
  LEAGUE_GROUP_SIZE,
  LEAGUE_PROMOTE_COUNT,
  LEAGUE_DEMOTE_COUNT,
  LEAGUE_TIERS,
} from "@git-racer/shared";
import type { LeagueTier } from "@git-racer/shared";
import { refreshCommitData } from "./commits.js";

/**
 * Return the Monday (start of ISO week) for the week containing `d`.
 * JavaScript's getDay() returns 0 for Sunday, so we treat 0 as 7
 * to normalize to an ISO weekday (Mon=1 .. Sun=7), then subtract
 * (day - 1) to rewind to Monday at midnight.
 */
function getMonday(d: Date): Date {
  const date = new Date(d);
  // getDay(): 0=Sun,1=Mon,...,6=Sat. Coerce Sunday (0) to 7 so the
  // arithmetic below always lands on the preceding Monday.
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Return the Sunday that ends the week starting on `monday`. */
function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
}

/** Format a Date as an ISO date string (YYYY-MM-DD) for use in DB queries. */
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Get or create the current week's league placement for a user.
 *
 * This is the main entry point for the league feature. It returns the user's
 * tier, group members sorted by weekly commit count, the user's current rank,
 * and how many days remain in the week.
 *
 * If the user has no membership row for the current week yet, one is lazily
 * created via {@link assignUserToLeague}, which also backfills the group
 * with ghost opponents drawn from a pool of tracked GitHub users.
 *
 * @param userId   - Internal DB user ID of the authenticated user.
 * @param username - GitHub username used for commit lookups and display.
 * @returns The league view (tier, ranked members, days remaining), or null
 *          if assignment failed.
 */
export async function getUserLeague(userId: number, username: string) {
  const monday = getMonday(new Date());
  const sunday = getSunday(monday);
  const weekStart = dateStr(monday);

  // Check if user already has a membership this week
  let [membership] = await db
    .select()
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.week_start, weekStart),
        eq(leagueMemberships.user_id, userId)
      )
    )
    .limit(1);

  // Lazy assignment if not found
  if (!membership) {
    await assignUserToLeague(userId, username, weekStart);
    [membership] = await db
      .select()
      .from(leagueMemberships)
      .where(
        and(
          eq(leagueMemberships.week_start, weekStart),
          eq(leagueMemberships.user_id, userId)
        )
      )
      .limit(1);
  }

  if (!membership) return null;

  // Get all members in the same group
  const groupMembers = await db
    .select()
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.week_start, weekStart),
        eq(leagueMemberships.tier, membership.tier),
        eq(leagueMemberships.group_number, membership.group_number)
      )
    );

  // Refresh commit data for all group members so the leaderboard is current.
  // Each call respects a 4-hour TTL cache, so repeated views are cheap.
  const memberUsernames = groupMembers.map((m) => m.github_username);
  await Promise.all(
    memberUsernames.map((u) =>
      refreshCommitData(u).catch((err) =>
        console.error("[refresh]", u, err.message)
      )
    )
  );

  // --- Live leaderboard data ---
  // Sum each group member's daily commit snapshots from Monday through today
  // to produce the real-time weekly commit total shown on the leaderboard.
  const todayStr = dateStr(new Date());

  // Query: aggregate commit_snapshots rows for all group members within the
  // current week window (weekStart..today). Uses an IN clause built
  // dynamically from the member list, and COALESCE so members with no
  // snapshot rows show 0 rather than NULL.
  const commits = memberUsernames.length > 0
    ? await db
        .select({
          github_username: commitSnapshots.github_username,
          total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
        })
        .from(commitSnapshots)
        .where(
          and(
            gte(commitSnapshots.date, weekStart),
            lte(commitSnapshots.date, todayStr),
            sql`${commitSnapshots.github_username} IN (${sql.join(
              memberUsernames.map((u) => sql`${u}`),
              sql`, `
            )})`
          )
        )
        .groupBy(commitSnapshots.github_username)
    : [];

  // Build a username -> total-commits lookup for O(1) access below.
  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));

  // --- Build the ranked leaderboard ---
  // Merge membership rows with live commit totals and sort descending.
  const members = groupMembers.map((m) => ({
    github_username: m.github_username,
    avatar_url: `https://github.com/${m.github_username}.png`,
    weekly_commits: commitMap.get(m.github_username) ?? 0,
    is_you: m.user_id === userId,
  }));

  // Sort descending by commits so the most active member is rank 1.
  members.sort((a, b) => b.weekly_commits - a.weekly_commits);

  // Assign 1-based rank after sorting.
  const ranked = members.map((m, i) => ({ ...m, rank: i + 1 }));
  const yourRank = ranked.find((m) => m.is_you)?.rank ?? 0;

  // Calculate days remaining in the league week. 86400000 = ms per day.
  // Math.ceil rounds partial days up so users see "1 day left" until midnight.
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((sunday.getTime() - now.getTime()) / 86400000));

  return {
    tier: membership.tier as LeagueTier,
    group_number: membership.group_number,
    week_start: weekStart,
    week_end: dateStr(sunday),
    members: ranked,
    your_rank: yourRank,
    days_left: daysLeft,
  };
}

/**
 * Assign a user to a league group for the given week.
 *
 * Tier determination:
 *   1. Look up last week's membership to see if the user was promoted or demoted.
 *   2. Shift their tier up or down accordingly, or keep it the same.
 *   3. First-time users start in "bronze".
 *
 * Group placement:
 *   - If an existing group in the target tier has fewer than 30 members, the
 *     user joins it.
 *   - Otherwise a brand-new group is created and backfilled with up to 29
 *     "ghost" opponents from the suggested_opponents pool, chosen by
 *     proximity to the user's last-week commit count (skill-based matchmaking).
 *
 * @param userId    - Internal DB user ID.
 * @param username  - GitHub username.
 * @param weekStart - ISO date string (YYYY-MM-DD) of the Monday that starts
 *                    the target week.
 */
async function assignUserToLeague(userId: number, username: string, weekStart: string) {
  // --- Step 1: Determine the user's tier for this week ---
  // Look back exactly 7 days to find last week's membership row.
  const lastMonday = new Date(weekStart + "T00:00:00Z");
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekStart = dateStr(lastMonday);

  const [previousMembership] = await db
    .select()
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.week_start, lastWeekStart),
        eq(leagueMemberships.user_id, userId)
      )
    )
    .limit(1);

  // Default to bronze for brand-new users (no prior membership).
  let tier: LeagueTier = "bronze";
  if (previousMembership) {
    const prevTier = previousMembership.tier as LeagueTier;
    const tierIdx = LEAGUE_TIERS.indexOf(prevTier);
    // Promote: move one tier up if the user finished in the top LEAGUE_PROMOTE_COUNT
    // and is not already at the highest tier.
    if (previousMembership.promoted && tierIdx < LEAGUE_TIERS.length - 1) {
      tier = LEAGUE_TIERS[tierIdx + 1];
    // Demote: move one tier down if the user finished in the bottom LEAGUE_DEMOTE_COUNT
    // and is not already at the lowest tier.
    } else if (previousMembership.demoted && tierIdx > 0) {
      tier = LEAGUE_TIERS[tierIdx - 1];
    } else {
      // Neither promoted nor demoted -- stay in the same tier.
      tier = prevTier;
    }
  }

  // --- Step 2: Find or create a group within the tier ---
  // Query the count of members in each existing group for this tier/week.
  const existingGroups = await db
    .select({
      group_number: leagueMemberships.group_number,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.week_start, weekStart),
        eq(leagueMemberships.tier, tier)
      )
    )
    .groupBy(leagueMemberships.group_number);

  // Try to find a group that hasn't reached the 30-member cap yet.
  const openGroup = existingGroups.find((g) => Number(g.count) < LEAGUE_GROUP_SIZE);

  if (openGroup) {
    // Join existing group
    await db
      .insert(leagueMemberships)
      .values({
        week_start: weekStart,
        user_id: userId,
        github_username: username,
        tier,
        group_number: openGroup.group_number,
        weekly_commits: 0,
      })
      .onConflictDoNothing();
    return;
  }

  // --- Step 3: Create a brand-new group and backfill with ghost opponents ---
  // The new group_number is one above the current maximum, or 0 if this is
  // the first group in the tier for the week.
  const groupNumber = existingGroups.length > 0
    ? Math.max(...existingGroups.map((g) => g.group_number)) + 1
    : 0;

  // Skill-based matchmaking: measure the user's commit activity from *last*
  // week so we can pick ghost opponents with a similar output level.
  const lastWeekEnd = dateStr(getSunday(lastMonday));
  const [userCommits] = await db
    .select({
      total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
    })
    .from(commitSnapshots)
    .where(
      and(
        eq(commitSnapshots.github_username, username),
        gte(commitSnapshots.date, lastWeekStart),
        lte(commitSnapshots.date, lastWeekEnd)
      )
    );
  // userLevel = total commits last week; used as the reference point for
  // picking opponents whose activity is closest.
  const userLevel = Number(userCommits?.total ?? 0);

  // Build a set of usernames already placed in a group this week so we
  // don't accidentally assign the same ghost to multiple groups.
  const alreadyAssigned = await db
    .select({ github_username: leagueMemberships.github_username })
    .from(leagueMemberships)
    .where(eq(leagueMemberships.week_start, weekStart));
  const assignedSet = new Set(alreadyAssigned.map((r) => r.github_username));
  assignedSet.add(username); // also exclude the current user from the pool

  // Fetch candidate ghost opponents from the suggested_opponents table.
  // We grab up to 200 so there's a large enough pool to pick the 29 closest.
  const poolUsers = await db
    .select({
      github_username: suggestedOpponents.github_username,
      avatar_url: suggestedOpponents.avatar_url,
    })
    .from(suggestedOpponents)
    .limit(200);

  // Filter out anyone already assigned to a league group this week.
  const poolUsernames = poolUsers
    .map((u) => u.github_username)
    .filter((u) => !assignedSet.has(u));

  if (poolUsernames.length === 0) {
    // No pool users available, just insert the user alone
    await db
      .insert(leagueMemberships)
      .values({
        week_start: weekStart,
        user_id: userId,
        github_username: username,
        tier,
        group_number: groupNumber,
        weekly_commits: 0,
      })
      .onConflictDoNothing();
    return;
  }

  // Query: aggregate each pool user's last-week commits so we can compare
  // their activity level to the real user's. Same SUM/COALESCE/IN pattern
  // used in getUserLeague, but over last week's date range.
  const poolCommits = await db
    .select({
      github_username: commitSnapshots.github_username,
      total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
    })
    .from(commitSnapshots)
    .where(
      and(
        gte(commitSnapshots.date, lastWeekStart),
        lte(commitSnapshots.date, lastWeekEnd),
        sql`${commitSnapshots.github_username} IN (${sql.join(
          poolUsernames.map((u) => sql`${u}`),
          sql`, `
        )})`
      )
    )
    .groupBy(commitSnapshots.github_username);

  const poolCommitMap = new Map(poolCommits.map((r) => [r.github_username, Number(r.total)]));

  // Skill-based matchmaking: sort candidates by the absolute difference
  // between their last-week commits and the user's last-week commits.
  // Take the 29 closest so the group totals LEAGUE_GROUP_SIZE (30) with
  // the real user included.
  const candidates = poolUsernames
    .map((u) => ({
      username: u,
      commits: poolCommitMap.get(u) ?? 0,
      diff: Math.abs((poolCommitMap.get(u) ?? 0) - userLevel),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, LEAGUE_GROUP_SIZE - 1);

  // Insert the real user
  await db
    .insert(leagueMemberships)
    .values({
      week_start: weekStart,
      user_id: userId,
      github_username: username,
      tier,
      group_number: groupNumber,
      weekly_commits: 0,
    })
    .onConflictDoNothing();

  // Insert ghost (pool) opponents into the same group. user_id is null to
  // distinguish them from real authenticated users.
  // Inserts are batched in chunks of 50 to stay within DB parameter limits
  // (some drivers cap the number of bind parameters per statement).
  if (candidates.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      await db
        .insert(leagueMemberships)
        .values(
          chunk.map((c) => ({
            week_start: weekStart,
            user_id: null, // ghost/pool user -- not a real authenticated user
            github_username: c.username,
            tier,
            group_number: groupNumber,
            weekly_commits: 0,
          }))
        )
        .onConflictDoNothing();
    }
  }
}

/**
 * Finalize all league groups for a completed week.
 *
 * This is intended to run once after a week ends (e.g., via a cron job on
 * Monday). It performs three steps:
 *   1. Fetches every membership row for the given week and aggregates each
 *      member's commit total from commit_snapshots.
 *   2. Groups members by tier + group_number, then sorts each group by
 *      commits descending to assign final ranks.
 *   3. Marks the top LEAGUE_PROMOTE_COUNT (5) members as "promoted" and the
 *      bottom LEAGUE_DEMOTE_COUNT (5) as "demoted". These flags are read by
 *      {@link assignUserToLeague} the following week to shift tiers.
 *
 * All updates are flushed to the database in a single bulk UPDATE statement
 * to minimize round-trips.
 *
 * @param weekStart - ISO date string (YYYY-MM-DD) of the Monday that started
 *                    the week to finalize.
 * @returns The number of membership rows processed.
 */
export async function finalizeWeek(weekStart: string): Promise<{ processed: number }> {
  const weekEnd = dateStr(getSunday(new Date(weekStart + "T00:00:00Z")));

  // Load every membership row for the target week.
  const allMemberships = await db
    .select()
    .from(leagueMemberships)
    .where(eq(leagueMemberships.week_start, weekStart));

  if (allMemberships.length === 0) return { processed: 0 };

  // --- Aggregate final commit totals for the full week ---
  // De-duplicate usernames (a user appears once per group, but the commit
  // query needs each username only once).
  const uniqueUsernames = [...new Set(allMemberships.map((m) => m.github_username))];
  const commits = uniqueUsernames.length > 0
    ? await db
        .select({
          github_username: commitSnapshots.github_username,
          total: sql<number>`coalesce(sum(${commitSnapshots.commit_count}), 0)`.as("total"),
        })
        .from(commitSnapshots)
        .where(
          and(
            gte(commitSnapshots.date, weekStart),
            lte(commitSnapshots.date, weekEnd),
            sql`${commitSnapshots.github_username} IN (${sql.join(
              uniqueUsernames.map((u) => sql`${u}`),
              sql`, `
            )})`
          )
        )
        .groupBy(commitSnapshots.github_username)
    : [];

  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));

  // --- Partition memberships into their league groups ---
  // Key: "tier:group_number" -> array of membership rows.
  // This lets us rank each group independently.
  const groupsByKey = new Map<string, typeof allMemberships>();
  for (const m of allMemberships) {
    const key = `${m.tier}:${m.group_number}`;
    if (!groupsByKey.has(key)) groupsByKey.set(key, []);
    groupsByKey.get(key)!.push(m);
  }

  // --- Compute final ranks and promotion/demotion flags ---
  const updates: { id: number; weekly_commits: number; final_rank: number; promoted: boolean; demoted: boolean }[] = [];

  for (const groupMembers of groupsByKey.values()) {
    // Sort descending by commit count so rank 1 = most commits.
    groupMembers.sort(
      (a, b) =>
        (commitMap.get(b.github_username) ?? 0) -
        (commitMap.get(a.github_username) ?? 0)
    );

    for (let i = 0; i < groupMembers.length; i++) {
      const m = groupMembers[i];
      const rank = i + 1; // 1-based rank

      updates.push({
        id: m.id,
        weekly_commits: commitMap.get(m.github_username) ?? 0,
        final_rank: rank,
        // Top 5 (rank 1-5) are promoted to the next tier.
        promoted: rank <= LEAGUE_PROMOTE_COUNT,
        // Bottom 5 are demoted. For a full group of 30 with LEAGUE_DEMOTE_COUNT=5,
        // this means ranks 26-30. The threshold is (groupSize - demoteCount),
        // so anyone ranked above that cutoff is demoted.
        demoted: rank > groupMembers.length - LEAGUE_DEMOTE_COUNT,
      });
    }
  }

  // --- Bulk-write all updates in a single SQL statement ---
  // Constructs a raw VALUES list and JOINs it against league_memberships
  // so we issue one UPDATE instead of N individual queries (O(1) round-trips).
  if (updates.length > 0) {
    const valuesClause = updates
      .map((u) => `(${u.id}, ${u.weekly_commits}, ${u.final_rank}, ${u.promoted}, ${u.demoted})`)
      .join(", ");

    await db.execute(sql`
      UPDATE league_memberships AS lm SET
        weekly_commits = v.weekly_commits,
        final_rank = v.final_rank,
        promoted = v.promoted,
        demoted = v.demoted
      FROM (VALUES ${sql.raw(valuesClause)})
        AS v(id, weekly_commits, final_rank, promoted, demoted)
      WHERE lm.id = v.id
    `);
  }

  return { processed: updates.length };
}
