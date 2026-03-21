export interface User {
  id: number;
  github_id: number;
  github_username: string;
  avatar_url: string | null;
  created_at: string;
}

export type ChallengeType = "1v1" | "team";
export type DurationType = "fixed" | "ongoing" | "goal";

export interface Challenge {
  id: number;
  name: string;
  type: ChallengeType;
  duration_type: DurationType;
  start_date: string;
  end_date: string | null;
  goal_target: number | null;
  goal_metric: string | null;
  created_by: number;
  share_slug: string;
  created_at: string;
}

export interface ChallengeParticipant {
  id: number;
  challenge_id: number;
  user_id: number | null;
  github_username: string;
  is_ghost: boolean;
  joined_at: string;
}

export interface CommitSnapshot {
  id: number;
  github_username: string;
  date: string;
  commit_count: number;
  fetched_at: string;
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

export interface ChallengeWithLeaderboard extends Challenge {
  participants: LeaderboardEntry[];
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
  share_slug: string;
  end_date: string | null;
  your_commits: number;
  leader_username: string;
  leader_commits: number;
  participant_count: number;
}
