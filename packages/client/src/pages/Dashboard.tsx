import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import type {
  UserStats,
  ActiveChallenge,
  FamousDevBenchmark,
  SocialCircleData,
  LeagueGroup,
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
  const [benchmarks, setBenchmarks] = useState<FamousDevBenchmark[]>([]);
  const [socialData, setSocialData] = useState<SocialCircleData>({ entries: [], your_rank: 0, total: 0 });
  const [league, setLeague] = useState<LeagueGroup | null>(null);
  const [streaks, setStreaks] = useState<UserStreakInfo | null>(null);
  const [contributions, setContributions] = useState<ContributionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);

  const loadBenchmarks = useCallback(() => {
    api<FamousDevBenchmark[]>("/benchmarks").then(setBenchmarks).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      api<UserStats>("/me/stats"),
      api<ActiveChallenge[]>("/me/challenges"),
      api<UserStreakInfo>("/me/streaks"),
      api<ContributionGraphData>("/me/contributions"),
      api<FamousDevBenchmark[]>("/benchmarks"),
    ])
      .then(([s, c, st, cont, b]) => {
        setStats(s);
        setChallenges(c);
        setStreaks(st);
        setContributions(cont);
        setBenchmarks(b);
      })
      .finally(() => setLoading(false));

    // Social + league load separately (slower)
    api<SocialCircleData>("/social/circle")
      .then(setSocialData)
      .catch(() => {})
      .finally(() => setSocialLoading(false));

    api<LeagueGroup>("/leagues/current")
      .then(setLeague)
      .catch(() => {});
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
      {streaks && (
        <StreakCard
          streaks={streaks}
          dailyCounts={contributions ? getThisWeekCounts(contributions.days) : undefined}
        />
      )}

      {/* Your Races */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Your Races</h2>
          <Link
            to="/challenges/new"
            className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md transition-colors"
          >
            New Race
          </Link>
        </div>

        {challenges.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm mb-3">No active races yet</p>
            <Link
              to="/challenges/new"
              className="text-green-400 hover:text-green-300 text-sm font-medium"
            >
              Start a race
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenges.map((ch) => {
              const winning = ch.your_commits >= ch.leader_commits || ch.leader_username === "";
              return (
                <Link
                  key={ch.id}
                  to={`/c/${ch.share_slug}`}
                  className={`block rounded-xl border p-4 transition-colors ${
                    winning
                      ? "bg-green-600/5 border-green-500/20 hover:border-green-500/40"
                      : "bg-gray-900 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold truncate">{ch.name}</h3>
                    <span className={`text-2xl font-bold tabular-nums ${winning ? "text-green-400" : "text-white"}`}>
                      {ch.your_commits}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{ch.participant_count} participants</span>
                    {ch.end_date && (
                      <span>ends {new Date(ch.end_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  {ch.leader_username && ch.leader_commits > ch.your_commits && (
                    <div className="mt-2 text-xs text-gray-500">
                      {ch.leader_username} leads with {ch.leader_commits}
                    </div>
                  )}
                  {winning && ch.leader_username !== "" && (
                    <div className="mt-2 text-xs text-green-400 font-medium">
                      You're in the lead
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Compare with devs */}
      <div>
        <h2 className="text-lg font-bold mb-1">How You Stack Up</h2>
        <p className="text-xs text-gray-500 mb-4">Your commits this week vs notable developers</p>
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

      {/* Your Circle — rank among people you follow */}
      <div>
        <h2 className="text-lg font-bold mb-3">Your Circle</h2>
        <p className="text-xs text-gray-500 mb-3">How you rank among developers you follow on GitHub this week</p>
        <SocialCircle data={socialData} loading={socialLoading} />
      </div>

      {/* Weekly League — at the bottom */}
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

      {/* Global Leaderboard */}
      <div>
        <Leaderboard />
      </div>
    </div>
  );
}

function getThisWeekCounts(days: { date: string; count: number }[]): number[] {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);

  const counts: number[] = [];
  const dayMap = new Map(days.map((d) => [d.date, d.count]));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    counts.push(dayMap.get(key) ?? 0);
  }
  return counts;
}
