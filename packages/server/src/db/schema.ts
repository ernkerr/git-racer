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
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  github_id: integer("github_id").notNull().unique(),
  github_username: varchar("github_username", { length: 255 }).notNull(),
  avatar_url: text("avatar_url"),
  access_token: text("access_token").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 10 }).notNull().default("1v1"),
  duration_type: varchar("duration_type", { length: 10 })
    .notNull()
    .default("fixed"),
  start_date: timestamp("start_date").notNull(),
  end_date: timestamp("end_date"),
  goal_target: integer("goal_target"),
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
    user_id: integer("user_id").references(() => users.id),
    github_username: varchar("github_username", { length: 255 }).notNull(),
    is_ghost: boolean("is_ghost").default(false).notNull(),
    joined_at: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.challenge_id, t.github_username)]
);

export const commitSnapshots = pgTable(
  "commit_snapshots",
  {
    id: serial("id").primaryKey(),
    github_username: varchar("github_username", { length: 255 }).notNull(),
    date: date("date").notNull(),
    commit_count: integer("commit_count").notNull().default(0),
    fetched_at: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.github_username, t.date)]
);

export const suggestedOpponents = pgTable("suggested_opponents", {
  id: serial("id").primaryKey(),
  github_username: varchar("github_username", { length: 255 }).notNull().unique(),
  avatar_url: text("avatar_url"),
  followers: integer("followers").notNull().default(0),
  fetched_at: timestamp("fetched_at").defaultNow().notNull(),
});

export const seedState = pgTable("seed_state", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  last_run_at: timestamp("last_run_at"),
  cursor: integer("cursor").notNull().default(0),
  metadata: jsonb("metadata"),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
