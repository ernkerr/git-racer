import type { LeagueGroup, LeagueTier } from "@git-racer/shared";

const TIER_CONFIG: Record<LeagueTier, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  bronze: { label: "Bronze", color: "text-amber-600", bg: "bg-amber-600/10", border: "border-amber-600/30", barColor: "bg-amber-600" },
  silver: { label: "Silver", color: "text-gray-300", bg: "bg-gray-400/10", border: "border-gray-400/30", barColor: "bg-gray-400" },
  gold: { label: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", barColor: "bg-yellow-400" },
  platinum: { label: "Platinum", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", barColor: "bg-cyan-400" },
  diamond: { label: "Diamond", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", barColor: "bg-purple-400" },
};

const ALL_TIERS: LeagueTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];
const PROMOTE_COUNT = 5;
const DEMOTE_COUNT = 5;

interface Props {
  league: LeagueGroup;
}

export default function LeagueCard({ league }: Props) {
  const config = TIER_CONFIG[league.tier];
  const totalMembers = league.members.length;
  const tierIndex = ALL_TIERS.indexOf(league.tier);

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-bold text-lg ${config.color}`}>{config.label} League</h3>
          <p className="text-xs text-gray-500">
            Week of {formatWeekDate(league.week_start)} &middot; {league.days_left === 0 ? "Final day" : `${league.days_left}d left`}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold tabular-nums ${config.color}`}>#{league.your_rank}</p>
          <p className="text-xs text-gray-500">of {totalMembers}</p>
        </div>
      </div>

      {/* Tier progress */}
      <div className="flex gap-1 mb-4">
        {ALL_TIERS.map((t, i) => (
          <div
            key={t}
            className={`h-1.5 flex-1 rounded-full ${
              i <= tierIndex ? TIER_CONFIG[t].barColor : "bg-gray-800"
            }`}
          />
        ))}
      </div>

      {/* How it works */}
      <div className="flex gap-4 mb-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Top {PROMOTE_COUNT} move up a tier
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Bottom {DEMOTE_COUNT} move down
        </span>
      </div>

      {/* Members list */}
      <div className="space-y-1 max-h-[360px] overflow-y-auto">
        {league.members.map((member) => {
          const isPromoteZone = member.rank <= PROMOTE_COUNT;
          const isDemoteZone = totalMembers > DEMOTE_COUNT && member.rank > totalMembers - DEMOTE_COUNT;
          const maxCommits = league.members[0]?.weekly_commits || 1;
          const barWidth = maxCommits > 0 ? (member.weekly_commits / maxCommits) * 100 : 0;

          return (
            <div
              key={member.github_username}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm overflow-hidden ${
                member.is_you
                  ? "bg-green-600/20 border border-green-500/40"
                  : isPromoteZone
                    ? "bg-green-900/10"
                    : isDemoteZone
                      ? "bg-red-900/10"
                      : "bg-gray-900/30"
              }`}
            >
              {/* Bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-green-500/8"
                style={{ width: `${barWidth}%` }}
              />

              <span className={`relative w-5 text-center font-bold text-xs ${
                isPromoteZone ? "text-green-400" : isDemoteZone ? "text-red-400" : "text-gray-500"
              }`}>
                {member.rank}
              </span>
              <img
                src={member.avatar_url ?? `https://github.com/${member.github_username}.png`}
                alt={member.github_username}
                className="relative w-6 h-6 rounded-full flex-shrink-0"
              />
              <span className={`relative flex-1 truncate ${member.is_you ? "font-semibold text-white" : "text-gray-300"}`}>
                {member.github_username}
                {member.is_you && <span className="text-green-400 text-xs ml-1">(you)</span>}
              </span>
              <span className="relative font-bold tabular-nums text-green-400 text-sm">
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
