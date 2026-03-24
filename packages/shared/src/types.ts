export interface User {
  id: number;
  github_id: number;
  github_username: string;
  avatar_url: string | null;
  created_at: string;
}

export type ChallengeType = "1v1" | "team";
export type DurationType = "fixed" | "ongoing" | "goal";
export type RefreshPeriod = "daily" | "weekly" | "ongoing";

export interface Challenge {
  id: number;
  name: string;
  type: ChallengeType;
  duration_type: DurationType;
  refresh_period: RefreshPeriod;
  start_date: string;
  end_date: string | null;
  goal_target: number | null;
  goal_metric: string | null;
  created_by: number;
  share_slug: string;
  created_at: string;
}

export interface UserStats {
  today: number;
  this_week: number;
  this_month: number;
  this_year: number;
  all_time: number;
}

export interface LeaderboardEntry {
  github_username: string;
  avatar_url: string | null;
  commit_count: number;
  is_ghost: boolean;
}

export interface RaceStats {
  total_commits: number;
  total_unique_repos: number;
  total_pushes: number;
  participant_count: number;
}

export interface ChallengeWithLeaderboard extends Challenge {
  participants: LeaderboardEntry[];
  daily?: Record<string, { date: string; count: number }[]>;
  race_stats?: RaceStats;
}

export interface SuggestedOpponent {
  github_username: string;
  avatar_url: string | null;
  followers: number;
}

export interface ActiveChallenge {
  id: number;
  name: string;
  type: ChallengeType;
  duration_type: DurationType;
  refresh_period: RefreshPeriod;
  share_slug: string;
  end_date: string | null;
  your_commits: number;
  leader_username: string;
  leader_commits: number;
  participant_count: number;
}

// --- League types ---

export type LeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface LeagueGroupMember {
  github_username: string;
  avatar_url: string | null;
  weekly_commits: number;
  rank: number;
  is_you: boolean;
}

export interface LeagueGroup {
  tier: LeagueTier;
  group_number: number;
  week_start: string;
  week_end: string;
  members: LeagueGroupMember[];
  your_rank: number;
  days_left: number;
}

// --- Starred / Benchmark types ---

export interface StarredUser {
  github_username: string;
  display_name: string;
  avatar_url: string | null;
  their_commits: number;
  your_commits: number;
  you_beat_them: boolean;
}

export interface StarSuggestion {
  github_username: string;
  display_name: string;
  known_for: string;
  avatar_url: string | null;
  commit_count: number;
}

/** @deprecated Use StarredUser */
export type FamousDevBenchmark = StarredUser & {
  known_for: string;
  category: string;
  is_custom: boolean;
};

export interface SocialCircleEntry {
  github_username: string;
  avatar_url: string | null;
  commit_count: number;
  rank: number;
  is_you: boolean;
}

export interface SocialCircleData {
  entries: SocialCircleEntry[];
  your_rank: number;
  total: number;
}

// --- Streak types ---

export interface UserStreakInfo {
  current_streak: number;
  longest_streak: number;
  best_week_commits: number;
  best_week_start: string | null;
  this_week: number;
  last_week: number;
  trend_percent: number;
}

// --- Contribution graph types ---

export interface ContributionDay {
  date: string;
  count: number;
  level: number; // 0-4 intensity
}

export interface ContributionGraphData {
  days: ContributionDay[];
  total_year: number;
}

// --- Share types ---

export interface ShareData {
  text: string;
  tweet: string;
  url: string;
  week_label: string;
}
