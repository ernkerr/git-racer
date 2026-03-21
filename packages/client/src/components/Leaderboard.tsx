import { useState, useEffect } from "react";
import { api } from "../lib/api.ts";

interface LeaderboardEntry {
  github_username: string;
  avatar_url: string;
  commit_count: number;
}

type Period = "day" | "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<LeaderboardEntry[]>(`/leaderboard?period=${period}&limit=25`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [period]);

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
          No contribution data yet. Start a race to see rankings!
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.github_username}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                i === 0
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : i === 1
                    ? "bg-gray-400/10 border border-gray-400/30"
                    : i === 2
                      ? "bg-amber-600/10 border border-amber-600/30"
                      : "bg-gray-900 border border-gray-800"
              }`}
            >
              {/* Rank */}
              <span
                className={`w-8 text-center font-bold text-lg ${
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
                className="w-10 h-10 rounded-full flex-shrink-0"
              />

              {/* Username */}
              <span className="font-medium flex-1 truncate">{entry.github_username}</span>

              {/* Commit count */}
              <span className="text-xl font-bold tabular-nums text-green-400">
                {entry.commit_count.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500 w-16">
                {entry.commit_count === 1 ? "commit" : "commits"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
