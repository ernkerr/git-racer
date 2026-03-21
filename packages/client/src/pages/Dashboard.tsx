import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import type { UserStats, ActiveChallenge } from "@git-racer/shared";
import Leaderboard from "../components/Leaderboard.tsx";

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<UserStats>("/me/stats"),
      api<ActiveChallenge[]>("/me/challenges"),
    ])
      .then(([s, c]) => {
        setStats(s);
        setChallenges(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading your stats...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Your Stats</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <StatsCard label="Today" value={stats.today} />
          <StatsCard label="This Week" value={stats.this_week} />
          <StatsCard label="This Month" value={stats.this_month} />
          <StatsCard label="This Year" value={stats.this_year} />
          <StatsCard label="All Time" value={stats.all_time} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Active Challenges</h2>
        <Link
          to="/challenges/new"
          className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md transition-colors"
        >
          New Challenge
        </Link>
      </div>

      {challenges.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No active challenges yet.</p>
          <Link
            to="/challenges/new"
            className="text-green-400 hover:text-green-300 font-medium"
          >
            Create your first challenge
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

      <div className="mt-12">
        <Leaderboard />
      </div>
    </div>
  );
}
