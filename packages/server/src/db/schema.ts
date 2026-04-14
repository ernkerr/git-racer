import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ─── Core user table ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  github_id: integer("github_id").notNull().unique(),
  github_username: varchar("github_username", { length: 255 }).notNull(),
  avatar_url: text("avatar_url"),
  access_token: text("access_token").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ─── Races (1v1 and team challenges) ──────────────────────────────

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 10 }).notNull().default("1v1"), // "1v1" | "team"
  duration_type: varchar("duration_type", { length: 10 })
    .notNull()
    .default("fixed"), // "fixed" | "ongoing" | "goal"
  refresh_period: varchar("refresh_period", { length: 10 }).notNull().default("weekly"), // "daily" | "weekly" | "ongoing"
  start_date: timestamp("start_date").notNull(),
  end_date: timestamp("end_date"), // null for ongoing challenges
  goal_target: integer("goal_target"), // only for "goal" duration type
  goal_metric: varchar("goal_metric", { length: 50 }),
  created_by: integer("created_by")
    .notNull()
    .references(() => users.id),
  share_slug: varchar("share_slug", { length: 20 }).notNull().unique(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    id: serial("id").primaryKey(),
    challenge_id: integer("challenge_id")
      .notNull()
      .references(() => challenges.id),
    user_id: integer("user_id").references(() => users.id), // null for ghost participants
    github_username: varchar("github_username", { length: 255 }).notNull(),
    is_ghost: boolean("is_ghost").default(false).notNull(), // true = user hasn't signed up
    joined_at: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.challenge_id, t.github_username),
    index("idx_cp_challenge_id").on(t.challenge_id),
    index("idx_cp_github_username").on(t.github_username),
  ]
);

// ─── Commit data (two separate tables, blended at query time) ─────

/**
 * Real commit counts fetched from GitHub GraphQL API.
 * Source of truth for app users (includes private repos) and enriched top users.
 * Refreshed on-demand with a 4-hour cache TTL.
 */
export const commitSnapshots = pgTable(
  "commit_snapshots",
  {
    id: serial("id").primaryKey(),
    github_username: varchar("github_username", { length: 255 }).notNull(),
    date: date("date").notNull(),
    commit_count: integer("commit_count").notNull().default(0),
    fetched_at: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.github_username, t.date),
    index("idx_cs_username_date").on(t.github_username, t.date),
    index("idx_cs_date").on(t.date),
  ]
);

// ─── Weekly leagues ───────────────────────────────────────────────

export const leagueMemberships = pgTable(
  "league_memberships",
  {
    id: serial("id").primaryKey(),
    week_start: date("week_start").notNull(),
    user_id: integer("user_id"), // null for ghost members from suggested_opponents pool
    github_username: varchar("github_username", { length: 255 }).notNull(),
    tier: varchar("tier", { length: 20 }).notNull().default("bronze"),
    group_number: integer("group_number").notNull().default(0),
    weekly_commits: integer("weekly_commits").notNull().default(0),
    final_rank: integer("final_rank"), // set during weekly finalization
    promoted: boolean("promoted").default(false),
    demoted: boolean("demoted").default(false),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.week_start, t.github_username),
    index("idx_lm_week_start").on(t.week_start),
    index("idx_lm_user_id").on(t.user_id),
  ]
);

// ─── User profile data ───────────────────────────────────────────

/** Cached streak metrics — recomputed every 4 hours. */
export const userStreaks = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  github_username: varchar("github_username", { length: 255 }).notNull().unique(),
  current_streak: integer("current_streak").notNull().default(0),
  longest_streak: integer("longest_streak").notNull().default(0),
  best_week_commits: integer("best_week_commits").notNull().default(0),
  best_week_start: date("best_week_start"),
  last_active_date: date("last_active_date"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

/** Users that someone has "starred" to track and compare against. */
export const userBenchmarks = pgTable(
  "user_benchmarks",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id),
    github_username: varchar("github_username", { length: 255 }).notNull(),
    display_name: varchar("display_name", { length: 255 }),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.user_id, t.github_username)]
);

// ─── Data pipeline & cron infrastructure ──────────────────────────

/**
 * Pool of top GitHub users by followers, used to:
 * 1. Populate league groups with "ghost" members
 * 2. Seed the daily leaderboard via batch contribution fetches
 * 3. Provide opponent suggestions for races
 */
export const suggestedOpponents = pgTable("suggested_opponents", {
  id: serial("id").primaryKey(),
  github_username: varchar("github_username", { length: 255 }).notNull().unique(),
  avatar_url: text("avatar_url"),
  followers: integer("followers").notNull().default(0),
  fetched_at: timestamp("fetched_at").defaultNow().notNull(),
});

/**
 * Cursor-based state tracking for cron jobs.
 * Enables resumable processing: if a job times out or hits rate limits,
 * the next invocation picks up from the stored cursor position.
 * metadata is JSONB for job-specific state (e.g., which hours are ingested).
 */
export const seedState = pgTable("seed_state", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  last_run_at: timestamp("last_run_at"),
  cursor: integer("cursor").notNull().default(0),
  metadata: jsonb("metadata"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Social features ──────────────────────────────────────────────

/** Cached GitHub following list for social circle rankings. 6-hour TTL. */
export const socialCircles = pgTable(
  "social_circles",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id),
    following_username: varchar("following_username", { length: 255 }).notNull(),
    avatar_url: text("avatar_url"),
    fetched_at: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.user_id, t.following_username)]
);
