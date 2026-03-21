import type { UserStreakInfo } from "@git-racer/shared";

interface Props {
  streaks: UserStreakInfo;
}

export default function StreakCard({ streaks }: Props) {
  const trendPositive = streaks.trend_percent >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current streak */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-orange-500 text-lg">
              {streaks.current_streak > 0 ? "\u{1f525}" : "\u{1f9ca}"}
            </span>
            <p className="text-xs text-gray-500">Current Streak</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.current_streak}
            <span className="text-sm text-gray-500 ml-1">days</span>
          </p>
        </div>

        {/* Longest streak */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-yellow-500 text-lg">{"\u{1f3c6}"}</span>
            <p className="text-xs text-gray-500">Longest Streak</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.longest_streak}
            <span className="text-sm text-gray-500 ml-1">days</span>
          </p>
        </div>

        {/* This week */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-lg ${trendPositive ? "text-green-500" : "text-red-500"}`}>
              {trendPositive ? "\u{2191}" : "\u{2193}"}
            </span>
            <p className="text-xs text-gray-500">This Week</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.this_week}
          </p>
          <p className={`text-xs ${trendPositive ? "text-green-400" : "text-red-400"}`}>
            {trendPositive ? "+" : ""}{streaks.trend_percent}% vs last week
          </p>
        </div>

        {/* Best week */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-purple-500 text-lg">{"\u{26a1}"}</span>
            <p className="text-xs text-gray-500">Best Week Ever</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.best_week_commits}
          </p>
          {streaks.best_week_start && (
            <p className="text-xs text-gray-500">
              {formatDate(streaks.best_week_start)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
