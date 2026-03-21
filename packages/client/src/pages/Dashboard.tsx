import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import type {
  UserStats,
  ActiveChallenge,
  SocialCircleData,
  UserStreakInfo,
  ContributionGraphData,
} from "@git-racer/shared";
import ContributionGraph from "../components/ContributionGraph.tsx";
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
  const [socialData, setSocialData] = useState<SocialCircleData>({ entries: [], your_rank: 0, total: 0 });
  const [streaks, setStreaks] = useState<UserStreakInfo | null>(null);
  const [contributions, setContributions] = useState<ContributionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<UserStats>("/me/stats"),
      api<ActiveChallenge[]>("/me/challenges"),
      api<UserStreakInfo>("/me/streaks"),
      api<ContributionGraphData>("/me/contributions"),
    ])
      .then(([s, c, st, cont]) => {
        setStats(s);
        setChallenges(c);
        setStreaks(st);
        setContributions(cont);
      })
      .finally(() => setLoading(false));

    // Social circle loads separately (needs GitHub API calls)
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
      {streaks && (
        <StreakCard
          streaks={streaks}
          dailyCounts={contributions ? getThisWeekCounts(contributions.days) : undefined}
        />
      )}

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
