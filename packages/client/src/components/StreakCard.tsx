import type { UserStreakInfo } from "@git-racer/shared";

interface Props {
  streaks: UserStreakInfo;
}

export default function StreakCard({ streaks }: Props) {
  const peak = Math.max(streaks.this_week, streaks.last_week, 1);
  const trendPositive = streaks.trend_percent >= 0;

  return (
    <div className="retro-box bg-arcade-surface p-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
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
                className="w-2.5 h-2.5 bg-arcade-pink border border-arcade-border"
                style={{ opacity: 0.4 + (i / Math.min(streaks.current_streak, 14)) * 0.6 }}
              />
            ))}
            {streaks.current_streak === 0 && (
              <div className="w-2.5 h-2.5 bg-arcade-bg border-2 border-arcade-border" />
            )}
          </div>
        </div>

        {/* Best streak */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Best Streak</p>
          <p className="font-pixel text-xl tabular-nums text-arcade-white">
            {streaks.longest_streak}
            <span className="font-pixel text-xs text-arcade-gray ml-1">days</span>
          </p>
          {streaks.longest_streak > 0 && (
            <div className="mt-2">
              <div className="h-3 bg-arcade-bg border-2 border-arcade-border overflow-hidden">
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

        {/* Week comparison — bar graph */}
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Week vs Week</p>
          <div className="flex items-end gap-3 h-16">
            {/* Last week bar */}
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-full transition-all"
                style={{
                  height: `${Math.max(4, Math.round((streaks.last_week / peak) * 56))}px`,
                  backgroundColor: "#444",
                }}
              />
              <p className="font-pixel text-[10px] text-arcade-gray mt-1">{streaks.last_week}</p>
            </div>
            {/* This week bar */}
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-full transition-all"
                style={{
                  height: `${Math.max(4, Math.round((streaks.this_week / peak) * 56))}px`,
                  backgroundColor: "#00C853",
                }}
              />
              <p className="font-pixel text-[10px] text-arcade-white mt-1">{streaks.this_week}</p>
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="flex items-center gap-1 font-pixel text-[10px] text-arcade-gray">
              <span className="inline-block w-2 h-2" style={{ backgroundColor: "#444" }} />
              LAST
            </span>
            <span className="flex items-center gap-1 font-pixel text-[10px] text-arcade-white">
              <span className="inline-block w-2 h-2" style={{ backgroundColor: "#00C853" }} />
              THIS
            </span>
          </div>
          <p className={`font-pixel text-[10px] mt-1 ${trendPositive ? "text-arcade-cyan" : "text-arcade-pink"}`}>
            {trendPositive ? "+" : ""}{streaks.trend_percent}%
          </p>
        </div>
      </div>
    </div>
  );
}
