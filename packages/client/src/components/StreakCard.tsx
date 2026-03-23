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
          <p className="font-pixel text-[8px] text-arcade-gray mb-2 uppercase leading-loose">Current Streak</p>
          <p className="font-pixel text-lg tabular-nums text-arcade-yellow">
            {streaks.current_streak}
            <span className="font-pixel text-[8px] text-arcade-gray ml-1">days</span>
          </p>
          {/* Streak dots — square, pixel style */}
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: Math.min(streaks.current_streak, 14) }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-arcade-yellow"
                style={{ opacity: 0.4 + (i / Math.min(streaks.current_streak, 14)) * 0.6 }}
              />
            ))}
            {streaks.current_streak === 0 && (
              <div className="w-2 h-2 bg-arcade-surface border border-arcade-gray" />
            )}
          </div>
        </div>

        {/* Longest streak */}
        <div>
          <p className="font-pixel text-[8px] text-arcade-gray mb-2 uppercase leading-loose">Best Streak</p>
          <p className="font-pixel text-lg tabular-nums text-arcade-yellow">
            {streaks.longest_streak}
            <span className="font-pixel text-[8px] text-arcade-gray ml-1">days</span>
          </p>
          {streaks.longest_streak > 0 && (
            <div className="mt-2">
              <div className="h-3 bg-arcade-bg border border-black overflow-hidden">
                <div
                  className="h-full bg-arcade-yellow transition-all"
                  style={{
                    width: `${Math.min(100, (streaks.current_streak / streaks.longest_streak) * 100)}%`,
                  }}
                />
              </div>
              <p className="font-pixel text-[8px] text-arcade-gray mt-1">
                {streaks.current_streak >= streaks.longest_streak
                  ? "NEW RECORD!"
                  : `${streaks.longest_streak - streaks.current_streak} TO BEAT`}
              </p>
            </div>
          )}
        </div>

        {/* This week */}
        <div>
          <p className="font-pixel text-[8px] text-arcade-gray mb-2 uppercase leading-loose">This Week</p>
          <p className="font-pixel text-lg tabular-nums text-arcade-yellow">
            {streaks.this_week}
          </p>
          <p className={`font-pixel text-[8px] mt-1 ${trendPositive ? "text-arcade-cyan" : "text-arcade-pink"}`}>
            {trendPositive ? "+" : ""}{streaks.trend_percent}% VS LAST WK
          </p>
        </div>

        {/* Best week */}
        <div>
          <p className="font-pixel text-[8px] text-arcade-gray mb-2 uppercase leading-loose">Best Week</p>
          <p className="font-pixel text-lg tabular-nums text-arcade-yellow">
            {streaks.best_week_commits}
          </p>
          {streaks.best_week_start && (
            <p className="font-mono text-[10px] text-arcade-gray mt-0.5">
              {formatDate(streaks.best_week_start)}
            </p>
          )}
          {streaks.best_week_commits > 0 && (
            <div className="mt-2">
              <div className="h-3 bg-arcade-bg border border-black overflow-hidden">
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
