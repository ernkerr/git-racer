import type { UserStreakInfo } from "@git-racer/shared";

interface Props {
  streaks: UserStreakInfo;
}

export default function StreakCard({ streaks }: Props) {
  const trendPositive = streaks.trend_percent >= 0;

  return (
    <div className="retro-box bg-arcade-surface p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {/* Current streak */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Current Streak</p>
          <p className="font-pixel text-xl tabular-nums text-arcade-white">
            {streaks.current_streak}
            <span className="font-pixel text-xs text-arcade-gray ml-1">days</span>
          </p>
          {/* Streak dots — square, neo-brutalist */}
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: Math.min(streaks.current_streak, 14) }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-arcade-pink border border-black"
                style={{ opacity: 0.4 + (i / Math.min(streaks.current_streak, 14)) * 0.6 }}
              />
            ))}
            {streaks.current_streak === 0 && (
              <div className="w-2.5 h-2.5 bg-arcade-bg border-2 border-black" />
            )}
          </div>
        </div>

        {/* Longest streak */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Best Streak</p>
          <p className="font-pixel text-xl tabular-nums text-arcade-white">
            {streaks.longest_streak}
            <span className="font-pixel text-xs text-arcade-gray ml-1">days</span>
          </p>
          {streaks.longest_streak > 0 && (
            <div className="mt-2">
              <div className="h-3 bg-arcade-bg border-2 border-black overflow-hidden">
                <div
                  className="h-full bg-arcade-pink transition-all"
                  style={{
                    width: `${Math.min(100, (streaks.current_streak / streaks.longest_streak) * 100)}%`,
                  }}
                />
              </div>
              <p className="font-pixel text-xs text-arcade-gray mt-1">
                {streaks.current_streak >= streaks.longest_streak
                  ? "NEW RECORD!"
                  : `${streaks.longest_streak - streaks.current_streak} TO BEAT`}
              </p>
            </div>
          )}
        </div>

        {/* This week */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">This Week</p>
          <p className="font-pixel text-xl tabular-nums text-arcade-white">
            {streaks.this_week}
          </p>
          <p className={`font-pixel text-xs mt-1 ${trendPositive ? "text-arcade-cyan" : "text-arcade-pink"}`}>
            {trendPositive ? "+" : ""}{streaks.trend_percent}% VS LAST WK
          </p>
        </div>

        {/* Best week */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Best Week</p>
          <p className="font-pixel text-xl tabular-nums text-arcade-white">
            {streaks.best_week_commits}
          </p>
          {streaks.best_week_start && (
            <p className="font-mono text-xs text-arcade-gray mt-0.5">
              {formatDate(streaks.best_week_start)}
            </p>
          )}
          {streaks.best_week_commits > 0 && (
            <div className="mt-2">
              <div className="h-3 bg-arcade-bg border-2 border-black overflow-hidden">
                <div
                  className="h-full bg-arcade-cyan transition-all"
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
