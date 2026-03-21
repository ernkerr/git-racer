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

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Get or create the current week's league for a user.
 * If no league exists for this week, creates a full group of 30
 * by mixing in tracked GitHub users from the pool.
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

  // Get live commit counts from commit_snapshots
  const todayStr = dateStr(new Date());
  const memberUsernames = groupMembers.map((m) => m.github_username);

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

  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));

  // Build ranked list
  const members = groupMembers.map((m) => ({
    github_username: m.github_username,
    avatar_url: `https://github.com/${m.github_username}.png`,
    weekly_commits: commitMap.get(m.github_username) ?? 0,
    is_you: m.user_id === userId,
  }));

  members.sort((a, b) => b.weekly_commits - a.weekly_commits);

  const ranked = members.map((m, i) => ({ ...m, rank: i + 1 }));
  const yourRank = ranked.find((m) => m.is_you)?.rank ?? 0;

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
 * Assign a user to a league for the given week.
 * Creates a full group of 30 by pulling active tracked users
 * with similar commit activity from the pool.
 */
async function assignUserToLeague(userId: number, username: string, weekStart: string) {
  // Determine tier from last week
  const lastMonday = new Date(weekStart + "T00:00:00Z");
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekStart = dateStr(lastMonday);

  const [prev] = await db
    .select()
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.week_start, lastWeekStart),
        eq(leagueMemberships.user_id, userId)
      )
    )
    .limit(1);

  let tier: LeagueTier = "bronze";
  if (prev) {
    const prevTier = prev.tier as LeagueTier;
    const tierIdx = LEAGUE_TIERS.indexOf(prevTier);
    if (prev.promoted && tierIdx < LEAGUE_TIERS.length - 1) {
      tier = LEAGUE_TIERS[tierIdx + 1];
    } else if (prev.demoted && tierIdx > 0) {
      tier = LEAGUE_TIERS[tierIdx - 1];
    } else {
      tier = prevTier;
    }
  }

  // Find a group in this tier with space (that already has pool users)
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

  // Create a new group: populate with 29 pool users + this user
  const groupNumber = existingGroups.length > 0
    ? Math.max(...existingGroups.map((g) => g.group_number)) + 1
    : 0;

  // Get the user's recent weekly commits to match them with similar-level competitors
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
  const userLevel = Number(userCommits?.total ?? 0);

  // Get pool users who already have commit data this week, excluding users already in a league this week
  const alreadyAssigned = await db
    .select({ github_username: leagueMemberships.github_username })
    .from(leagueMemberships)
    .where(eq(leagueMemberships.week_start, weekStart));
  const assignedSet = new Set(alreadyAssigned.map((r) => r.github_username));
  assignedSet.add(username); // exclude self

  // Get pool users with their weekly commit counts, sorted by proximity to the user's level
  const poolUsers = await db
    .select({
      github_username: suggestedOpponents.github_username,
      avatar_url: suggestedOpponents.avatar_url,
    })
    .from(suggestedOpponents)
    .limit(200);

  // Get their commit counts for last week to match activity levels
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

  // Sort pool users by how close their commit count is to the user's
  const candidates = poolUsernames
    .map((u) => ({
      username: u,
      commits: poolCommitMap.get(u) ?? 0,
      diff: Math.abs((poolCommitMap.get(u) ?? 0) - userLevel),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, LEAGUE_GROUP_SIZE - 1); // Pick 29 closest

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

  // Insert pool users as ghost league members (user_id = 0 signals ghost)
  if (candidates.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      const chunk = candidates.slice(i, i + chunkSize);
      await db
        .insert(leagueMemberships)
        .values(
          chunk.map((c) => ({
            week_start: weekStart,
            user_id: null, // ghost/pool user
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
 * Run weekly league finalization: compute final ranks, set promote/demote flags.
 */
export async function finalizeWeek(weekStart: string): Promise<{ processed: number }> {
  const weekEnd = dateStr(getSunday(new Date(weekStart + "T00:00:00Z")));

  const all = await db
    .select()
    .from(leagueMemberships)
    .where(eq(leagueMemberships.week_start, weekStart));

  if (all.length === 0) return { processed: 0 };

  const usernames = [...new Set(all.map((m) => m.github_username))];
  const commits = usernames.length > 0
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
              usernames.map((u) => sql`${u}`),
              sql`, `
            )})`
          )
        )
        .groupBy(commitSnapshots.github_username)
    : [];

  const commitMap = new Map(commits.map((r) => [r.github_username, Number(r.total)]));

  // Group by tier + group_number
  const groups = new Map<string, typeof all>();
  for (const m of all) {
    const key = `${m.tier}:${m.group_number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  let processed = 0;

  for (const members of groups.values()) {
    members.sort(
      (a, b) =>
        (commitMap.get(b.github_username) ?? 0) -
        (commitMap.get(a.github_username) ?? 0)
    );

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const rank = i + 1;
      const promoted = rank <= LEAGUE_PROMOTE_COUNT;
      const demoted = rank > members.length - LEAGUE_DEMOTE_COUNT;

      await db
        .update(leagueMemberships)
        .set({
          weekly_commits: commitMap.get(m.github_username) ?? 0,
          final_rank: rank,
          promoted,
          demoted,
        })
        .where(eq(leagueMemberships.id, m.id));

      processed++;
    }
  }

  return { processed };
}
