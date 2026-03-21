import { useState, useEffect } from "react";
import { api } from "../lib/api.ts";

interface LeaderboardEntry {
  github_username: string;
  avatar_url: string;
  commit_count: number;
}

type Period = "day" | "week" | "month" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Yesterday",
  week: "This Week",
  month: "This Month",
  yearly: "This Year",
};

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(10);

  useEffect(() => {
    setLoading(true);
    setVisible(10);
    api<LeaderboardEntry[]>(`/leaderboard?period=${period}&limit=100`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [period]);

  const maxCommits = entries.length > 0 ? entries[0].commit_count : 1;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>

      {/* Period Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 mb-6">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              period === p
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading leaderboard...</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          Leaderboard updates daily. Check back soon!
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.slice(0, visible).map((entry, i) => {
            const barWidth = maxCommits > 0 ? (entry.commit_count / maxCommits) * 100 : 0;
            return (
              <div
                key={entry.github_username}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg overflow-hidden ${
                  i === 0
                    ? "bg-yellow-500/10 border border-yellow-500/30"
                    : i === 1
                      ? "bg-gray-400/10 border border-gray-400/30"
                      : i === 2
                        ? "bg-amber-600/10 border border-amber-600/30"
                        : "bg-gray-900 border border-gray-800"
                }`}
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-green-500/8 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />

                {/* Rank */}
                <span
                  className={`relative w-7 text-center font-bold text-sm ${
                    i === 0
                      ? "text-yellow-400"
                      : i === 1
                        ? "text-gray-300"
                        : i === 2
                          ? "text-amber-500"
                          : "text-gray-500"
                  }`}
                >
                  {i + 1}
                </span>

                {/* Avatar */}
                <img
                  src={entry.avatar_url}
                  alt={entry.github_username}
                  className="relative w-8 h-8 rounded-full flex-shrink-0"
                />

                {/* Username */}
                <span className="relative font-medium flex-1 truncate text-sm">
                  {entry.github_username}
                </span>

                {/* Commit count */}
                <span className="relative text-lg font-bold tabular-nums text-green-400">
                  {entry.commit_count.toLocaleString()}
                </span>
              </div>
            );
          })}
          {visible < entries.length && (
            <button
              onClick={() => setVisible((v) => v + 10)}
              className="w-full py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
            >
              + Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
