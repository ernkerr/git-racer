import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import type {
  UserStats,
  ActiveChallenge,
  LeagueGroup,
  FamousDevBenchmark,
  SocialCircleData,
  UserStreakInfo,
  ContributionGraphData,
} from "@git-racer/shared";
import ContributionGraph from "../components/ContributionGraph.tsx";
import LeagueCard from "../components/LeagueCard.tsx";
import BenchmarkCards from "../components/BenchmarkCards.tsx";
import StreakCard from "../components/StreakCard.tsx";
import SocialCircle from "../components/SocialCircle.tsx";
import ShareButton from "../components/ShareButton.tsx";
import Leaderboard from "../components/Leaderboard.tsx";

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [league, setLeague] = useState<LeagueGroup | null>(null);
  const [benchmarks, setBenchmarks] = useState<FamousDevBenchmark[]>([]);
  const [socialData, setSocialData] = useState<SocialCircleData>({ entries: [], your_rank: 0, total: 0 });
  const [streaks, setStreaks] = useState<UserStreakInfo | null>(null);
  const [contributions, setContributions] = useState<ContributionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);

  const loadBenchmarks = useCallback(() => {
    api<FamousDevBenchmark[]>("/benchmarks?period=week").then(setBenchmarks).catch(() => {});
  }, []);

  useEffect(() => {
    // Single consolidated call for core dashboard data
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
      .finally(() => setLoading(false));

    // These load independently (separate APIs / slower)
    api<LeagueGroup>("/leagues/current").then(setLeague).catch(() => {});
    api<FamousDevBenchmark[]>("/benchmarks?period=week").then(setBenchmarks).catch(() => []);
    api<SocialCircleData>("/social/circle")
      .then(setSocialData)
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading your stats...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header + Share */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
          <h2 className="text-lg font-bold">Active Races</h2>
          <Link
            to="/challenges/new"
            className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md transition-colors"
          >
            New Race
          </Link>
        </div>

        {challenges.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No active races yet.</p>
            <Link
              to="/challenges/new"
              className="text-green-400 hover:text-green-300 font-medium"
            >
              Create your first race
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((ch) => (
              <Link
                key={ch.id}
                to={`/c/${ch.share_slug}`}
                className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{ch.name}</h3>
                    <p className="text-sm text-gray-400">
                      {ch.participant_count} participants
                      {ch.end_date &&
                        ` \u00b7 ends ${new Date(ch.end_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums">
                      {ch.your_commits}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ch.leader_username === "" ? "" : ch.leader_commits > ch.your_commits
                        ? `${ch.leader_username} leads with ${ch.leader_commits}`
                        : "You're in the lead!"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Famous Dev Benchmarks */}
      <div>
        <h2 className="text-lg font-bold mb-3">vs Famous Devs</h2>
        <BenchmarkCards
          benchmarks={benchmarks}
          onAdded={loadBenchmarks}
          onRemoved={(username) => {
            setBenchmarks((prev) => prev.filter((b) => b.github_username !== username));
          }}
        />
      </div>

      {/* Contribution Graph */}
      {contributions && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <ContributionGraph days={contributions.days} totalYear={contributions.total_year} />
        </div>
      )}

      {/* Two-column layout: League + Social */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly League */}
        <div>
          <h2 className="text-lg font-bold mb-3">Weekly League</h2>
          {league ? (
            <LeagueCard league={league} />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              Your league is being set up. Check back soon!
            </div>
          )}
        </div>

        {/* Social Circle */}
        <div>
          <h2 className="text-lg font-bold mb-3">Your Circle</h2>
          <SocialCircle data={socialData} loading={socialLoading} />
        </div>
      </div>

      {/* Global Leaderboard */}
      <div>
        <Leaderboard />
      </div>
    </div>
  );
}
