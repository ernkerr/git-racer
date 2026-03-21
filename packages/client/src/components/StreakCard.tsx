import type { UserStreakInfo } from "@git-racer/shared";

interface Props {
  streaks: UserStreakInfo;
  dailyCounts?: number[]; // 7 days of commit counts for the mini chart
}

export default function StreakCard({ streaks, dailyCounts }: Props) {
  const trendPositive = streaks.trend_percent >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {/* Current streak */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Current Streak</p>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.current_streak}
            <span className="text-sm text-gray-500 ml-1">days</span>
          </p>
          {/* Streak dots */}
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: Math.min(streaks.current_streak, 14) }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-green-500"
                style={{ opacity: 0.4 + (i / Math.min(streaks.current_streak, 14)) * 0.6 }}
              />
            ))}
            {streaks.current_streak === 0 && (
              <div className="w-2 h-2 rounded-full bg-gray-700" />
            )}
          </div>
        </div>

        {/* Longest streak */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Longest Streak</p>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.longest_streak}
            <span className="text-sm text-gray-500 ml-1">days</span>
          </p>
          {/* Progress toward record */}
          {streaks.longest_streak > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (streaks.current_streak / streaks.longest_streak) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {streaks.current_streak >= streaks.longest_streak
                  ? "New record!"
                  : `${streaks.longest_streak - streaks.current_streak} to beat`}
              </p>
            </div>
          )}
        </div>

        {/* This week with mini bar chart */}
        <div>
          <p className="text-xs text-gray-500 mb-1">This Week</p>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.this_week}
          </p>
          <p className={`text-xs mt-0.5 ${trendPositive ? "text-green-400" : "text-red-400"}`}>
            {trendPositive ? "+" : ""}{streaks.trend_percent}% vs last week
          </p>
          {/* Mini bar chart */}
          {dailyCounts && dailyCounts.length > 0 && (
            <div className="flex items-end gap-px mt-2 h-6">
              {dailyCounts.map((count, i) => {
                const max = Math.max(1, ...dailyCounts);
                const height = count > 0 ? Math.max(3, (count / max) * 24) : 2;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${count > 0 ? "bg-green-500" : "bg-gray-700"}`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Best week */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Best Week</p>
          <p className="text-2xl font-bold tabular-nums">
            {streaks.best_week_commits}
          </p>
          {streaks.best_week_start && (
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(streaks.best_week_start)}
            </p>
          )}
          {/* Progress toward best */}
          {streaks.best_week_commits > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (streaks.this_week / streaks.best_week_commits) * 100)}%`,
                  }}
                />
              </div>
            </div>
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
