import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import type {
  UserStats,
  ActiveChallenge,
  LeagueGroup,
  StarredUser,
  StarSuggestion,
  SocialCircleData,
  UserStreakInfo,
  ContributionGraphData,
} from "@git-racer/shared";
import ContributionGraph from "../components/ContributionGraph.tsx";
import LeagueCard from "../components/LeagueCard.tsx";
import StarredUsers from "../components/StarredUsers.tsx";
import StreakCard from "../components/StreakCard.tsx";
import SocialCircle from "../components/SocialCircle.tsx";
import ShareButton from "../components/ShareButton.tsx";
import Leaderboard from "../components/Leaderboard.tsx";

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="retro-box bg-arcade-surface p-4">
      <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">{label}</p>
      <p className="font-pixel text-2xl tabular-nums text-arcade-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [league, setLeague] = useState<LeagueGroup | null>(null);
  const [starred, setStarred] = useState<StarredUser[]>([]);
  const [suggestions, setSuggestions] = useState<StarSuggestion[]>([]);
  const [socialData, setSocialData] = useState<SocialCircleData>({ entries: [], your_rank: 0, total: 0 });
  const [streaks, setStreaks] = useState<UserStreakInfo | null>(null);
  const [contributions, setContributions] = useState<ContributionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);

  const loadStarred = useCallback(() => {
    api<StarredUser[]>("/starred?period=week").then(setStarred).catch(() => {});
    api<StarSuggestion[]>("/starred/suggestions").then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    api<{
      stats: UserStats;
      challenges: ActiveChallenge[];
      streaks: UserStreakInfo;
      contributions: ContributionGraphData;
    }>("/me/dashboard")
      .then((data) => {
        setStats(data.stats);
        setChallenges(data.challenges);
        setStreaks(data.streaks);
        setContributions(data.contributions);
      })
      .catch((err) => console.error("Dashboard load failed:", err))
      .finally(() => setLoading(false));

    api<LeagueGroup>("/leagues/current").then(setLeague).catch(() => {});
    api<StarredUser[]>("/starred?period=week").then(setStarred).catch(() => []);
    api<StarSuggestion[]>("/starred/suggestions").then(setSuggestions).catch(() => []);
    api<SocialCircleData>("/social/circle")
      .then(setSocialData)
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, []);

  if (loading) {
    return <div className="font-pixel text-sm text-arcade-gray">LOADING YOUR STATS...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="checker-bar" />

      {/* Header + Share */}
      <div className="flex items-center justify-between">
        <h1 className="font-pixel text-2xl text-arcade-white">
          DASHBOARD
        </h1>
        <ShareButton />
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatsCard label="Today" value={stats.today} />
          <StatsCard label="This Week" value={stats.this_week} />
          <StatsCard label="This Month" value={stats.this_month} />
          <StatsCard label="This Year" value={stats.this_year} />
          <StatsCard label="All Time" value={stats.all_time} />
        </div>
      )}

      {/* Streaks & Records */}
      {streaks && <StreakCard streaks={streaks} />}

      {/* Active Races */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-base text-arcade-cyan">ACTIVE RACES</h2>
          <Link
            to="/challenges/new"
            className="btn-arcade bg-arcade-pink text-black font-pixel text-xs px-3 py-2"
          >
            NEW RACE
          </Link>
        </div>

        {challenges.length === 0 ? (
          <div className="retro-box bg-arcade-surface p-8 text-center">
            <p className="font-pixel text-sm text-arcade-gray mb-4">NO ACTIVE RACES YET.</p>
            <Link
              to="/challenges/new"
              className="font-pixel text-sm text-arcade-cyan hover:text-arcade-pink transition-colors"
            >
              CREATE YOUR FIRST RACE
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((ch) => (
              <Link
                key={ch.id}
                to={`/c/${ch.share_slug}`}
                className="retro-box bg-arcade-surface p-4 block hover:-translate-y-px transition-all"
                style={
                  ch.leader_username && ch.leader_commits > ch.your_commits
                    ? { borderColor: "#DC2626" }
                    : ch.leader_username && ch.leader_commits < ch.your_commits
                    ? { borderColor: "#16A34A" }
                    : ch.leader_username && ch.leader_commits === ch.your_commits
                    ? { borderColor: "#EAB308" }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-pixel text-base text-arcade-white">{ch.name}</h3>
                    <p className="font-mono text-xs text-arcade-gray mt-1">
                      {ch.participant_count} participants
                      {ch.end_date &&
                        ` · ends ${new Date(ch.end_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-pixel text-3xl tabular-nums text-arcade-white">
                      {ch.your_commits}
                    </p>
                    <p className="font-pixel text-xs" style={{
                      color: ch.leader_username === "" ? "#78716C"
                        : ch.leader_commits > ch.your_commits ? "#DC2626"
                        : ch.leader_commits < ch.your_commits ? "#16A34A"
                        : "#EAB308"
                    }}>
                      {ch.leader_username === "" ? "" : ch.leader_commits > ch.your_commits
                        ? `${ch.leader_commits - ch.your_commits} BEHIND`
                        : ch.leader_commits < ch.your_commits ? "YOU LEAD"
                        : "TIED"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Starred Users */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">STARRED DEVS</h2>
        <StarredUsers
          starred={starred}
          suggestions={suggestions}
          onStar={loadStarred}
          onUnstar={(username) => {
            setStarred((prev) => prev.filter((s) => s.github_username !== username));
            loadStarred();
          }}
        />
      </div>

      {/* Social Circle */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">YOUR CIRCLE</h2>
        <SocialCircle data={socialData} loading={socialLoading} />
      </div>

      {/* Global Leaderboard */}
      <div>
        <Leaderboard />
      </div>

      {/* Weekly League */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">WEEKLY LEAGUE</h2>
        {league ? (
          <LeagueCard league={league} />
        ) : (
          <div className="retro-box bg-arcade-surface p-6 text-center">
            <p className="font-pixel text-sm text-arcade-gray">YOUR LEAGUE IS BEING SET UP. CHECK BACK SOON!</p>
          </div>
        )}
      </div>

      {/* Contribution Graph */}
      {contributions && (
        <div className="retro-box bg-arcade-surface p-5">
          <ContributionGraph days={contributions.days} totalYear={contributions.total_year} />
        </div>
      )}
    </div>
  );
}
