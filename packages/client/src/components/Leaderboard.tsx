import { useState, useEffect } from "react";
import { api } from "../lib/api.ts";

interface LeaderboardEntry {
  github_username: string;
  avatar_url: string;
  commit_count: number;
}

type Period = "day" | "week" | "month" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  day: "TODAY",
  week: "THIS WEEK",
  month: "THIS MONTH",
  yearly: "THIS YEAR",
};

const RANK_ORDINALS = ["1ST", "2ND", "3RD"];
const RANK_COLORS = [
  "text-arcade-yellow",
  "text-arcade-cyan",
  "text-arcade-pink",
];
const ROW_BORDER_COLORS = [
  "border-arcade-yellow",
  "border-arcade-cyan",
  "border-arcade-pink",
];

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(10);
  const [showInfo, setShowInfo] = useState(false);

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
      <div className="flex items-center justify-center gap-3 mb-6">
        <h2 className="font-pixel text-lg text-arcade-yellow" style={{ textShadow: "2px 2px 0px #000" }}>
          HI-SCORES
        </h2>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-arcade-gray hover:text-arcade-cyan transition-colors"
          title="How rankings work"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {showInfo && (
        <div className="retro-box bg-arcade-surface p-4 mb-6 text-sm text-arcade-gray space-y-2">
          <p>
            Rankings are based on <span className="text-arcade-cyan">real public GitHub activity</span> from
            every push event across all of GitHub, updated daily.
          </p>
          <p>
            If you have a Git Racer account, your ranking uses your <span className="text-arcade-cyan">actual commit count</span> (including
            private repos) so your number matches your dashboard.
          </p>
          <p>
            For everyone else, rankings are based on public pushes tracked
            via <span className="text-arcade-cyan">GH Archive</span>.
          </p>
        </div>
      )}

      {/* Period Tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`btn-arcade flex-1 py-2 font-pixel text-[8px] leading-loose ${
              period === p
                ? "bg-arcade-pink text-black"
                : "bg-arcade-surface text-arcade-gray hover:text-arcade-white"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      {loading ? (
        <div className="font-pixel text-xs text-arcade-gray text-center py-12 blink">
          LOADING...
        </div>
      ) : entries.length === 0 ? (
        <div className="font-pixel text-xs text-arcade-gray text-center py-12">
          NO DATA YET. CHECK BACK SOON!
        </div>
      ) : (
        <div className="space-y-2">
          {entries.slice(0, visible).map((entry, i) => {
            const barWidth = maxCommits > 0 ? (entry.commit_count / maxCommits) * 100 : 0;
            const isTop3 = i < 3;
            return (
              <div
                key={entry.github_username}
                className={`retro-box relative flex items-center gap-3 px-4 py-3 overflow-hidden bg-arcade-surface ${isTop3 ? ROW_BORDER_COLORS[i] : ""}`}
                style={isTop3 ? { borderColor: undefined } : undefined}
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-arcade-yellow/10 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />

                {/* Rank */}
                <span className={`relative font-pixel text-[8px] w-8 text-center ${isTop3 ? RANK_COLORS[i] : "text-arcade-gray"}`}>
                  {i < 3 ? RANK_ORDINALS[i] : i + 1}
                </span>

                {/* Avatar */}
                <img
                  src={entry.avatar_url}
                  alt={entry.github_username}
                  className="relative w-8 h-8 rounded-none border-2 border-arcade-gray shrink-0"
                />

                {/* Username */}
                <span className="relative font-mono text-sm text-arcade-white flex-1 truncate">
                  {entry.github_username}
                </span>

                {/* Commit count */}
                <span className="relative font-pixel text-sm tabular-nums text-arcade-yellow">
                  {entry.commit_count.toLocaleString()}
                </span>
              </div>
            );
          })}
          {visible < entries.length && (
            <button
              onClick={() => setVisible((v) => v + 10)}
              className="btn-arcade w-full py-2 font-pixel text-[8px] bg-arcade-surface text-arcade-gray hover:text-arcade-white"
            >
              + SHOW MORE
            </button>
          )}
        </div>
      )}
    </div>
  );
}
