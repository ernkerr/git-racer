import type { LeagueGroup, LeagueTier } from "@git-racer/shared";

const TIER_CONFIG: Record<LeagueTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
  bronze: { label: "Bronze", color: "text-amber-600", bg: "bg-amber-600/10", border: "border-amber-600/30", icon: "\u{1f949}" },
  silver: { label: "Silver", color: "text-gray-300", bg: "bg-gray-400/10", border: "border-gray-400/30", icon: "\u{1f948}" },
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: "\u{1f947}" },
  platinum: { label: "Platinum", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: "\u{1f48e}" },
  diamond: { label: "Diamond", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: "\u{2b50}" },
};

const PROMOTE_COUNT = 5;
const DEMOTE_COUNT = 5;

interface Props {
  league: LeagueGroup;
}

export default function LeagueCard({ league }: Props) {
  const config = TIER_CONFIG[league.tier];
  const totalMembers = league.members.length;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className={`font-bold text-lg ${config.color}`}>{config.label} League</h3>
            <p className="text-xs text-gray-500">
              Week of {formatWeekDate(league.week_start)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${config.color}`}>#{league.your_rank}</p>
          <p className="text-xs text-gray-500">
            {league.days_left === 0 ? "Final day!" : `${league.days_left} days left`}
          </p>
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex gap-3 mb-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Top 5 promote
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Bottom 5 demote
        </span>
      </div>

      {/* Members list */}
      <div className="space-y-1 max-h-[360px] overflow-y-auto">
        {league.members.map((member) => {
          const isPromoteZone = member.rank <= PROMOTE_COUNT;
          const isDemoteZone = member.rank > totalMembers - DEMOTE_COUNT;

          return (
            <div
              key={member.github_username}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                member.is_you
                  ? "bg-green-600/20 border border-green-500/40"
                  : isPromoteZone
                    ? "bg-green-900/20"
                    : isDemoteZone
                      ? "bg-red-900/20"
                      : "bg-gray-900/50"
              }`}
            >
              <span className={`w-5 text-center font-bold text-xs ${
                isPromoteZone ? "text-green-400" : isDemoteZone ? "text-red-400" : "text-gray-500"
              }`}>
                {member.rank}
              </span>
              <img
                src={member.avatar_url ?? `https://github.com/${member.github_username}.png`}
                alt={member.github_username}
                className="w-6 h-6 rounded-full flex-shrink-0"
              />
              <span className={`flex-1 truncate ${member.is_you ? "font-semibold text-white" : "text-gray-300"}`}>
                {member.github_username}
                {member.is_you && <span className="text-green-400 text-xs ml-1">(you)</span>}
              </span>
              <span className="font-bold tabular-nums text-green-400">
                {member.weekly_commits}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
