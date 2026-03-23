import type { LeagueGroup, LeagueTier } from "@git-racer/shared";

const TIER_CONFIG: Record<LeagueTier, {
  label: string;
  color: string;
  bg: string;
  borderClass: string;
  borderColor: string;
  barColor: string;
}> = {
  bronze:   { label: "BRONZE",   color: "text-[#CD7F32]", bg: "bg-[#2A1A00]",    borderClass: "border-[#CD7F32]", borderColor: "#CD7F32", barColor: "bg-[#CD7F32]"        },
  silver:   { label: "SILVER",   color: "text-arcade-gray",  bg: "bg-arcade-surface", borderClass: "border-arcade-gray",  borderColor: "#888888", barColor: "bg-arcade-gray"   },
  gold:     { label: "GOLD",     color: "text-arcade-yellow", bg: "bg-arcade-surface", borderClass: "border-arcade-yellow", borderColor: "#FFE600", barColor: "bg-arcade-yellow" },
  platinum: { label: "PLATINUM", color: "text-arcade-cyan",  bg: "bg-arcade-surface", borderClass: "border-arcade-cyan",  borderColor: "#00F5FF", barColor: "bg-arcade-cyan"   },
  diamond:  { label: "DIAMOND",  color: "text-arcade-pink",  bg: "bg-arcade-surface", borderClass: "border-arcade-pink",  borderColor: "#FF006E", barColor: "bg-arcade-pink"   },
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
    <div
      className={`retro-box ${config.bg} p-5`}
      style={{ borderColor: config.borderColor, borderWidth: "4px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-pixel text-sm ${config.color}`} style={{ textShadow: "2px 2px 0px #000" }}>
            {config.label} LEAGUE
          </h3>
          <p className="font-mono text-[10px] text-arcade-gray mt-1">
            WK OF {formatWeekDate(league.week_start)} &middot; {league.days_left === 0 ? "FINAL DAY" : `${league.days_left}D LEFT`}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-pixel text-2xl tabular-nums ${config.color}`} style={{ textShadow: "2px 2px 0px #000" }}>
            #{league.your_rank}
          </p>
          <p className="font-mono text-[10px] text-arcade-gray">of {totalMembers}</p>
        </div>
      </div>

      {/* Tier progress */}
      <div className="flex gap-1 mb-4">
        {ALL_TIERS.map((t, i) => (
          <div
            key={t}
            className={`h-2.5 flex-1 border border-black ${
              i <= tierIndex ? TIER_CONFIG[t].barColor : "bg-arcade-bg"
            }`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3">
        <span className="flex items-center gap-1 font-pixel text-[8px] text-arcade-gray">
          <span className="w-2 h-2 bg-arcade-cyan" />
          TOP {PROMOTE_COUNT} MOVE UP
        </span>
        <span className="flex items-center gap-1 font-pixel text-[8px] text-arcade-gray">
          <span className="w-2 h-2 bg-arcade-pink" />
          BOTTOM {DEMOTE_COUNT} DROP
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
              className={`relative flex items-center gap-3 px-3 py-2 text-sm overflow-hidden ${
                member.is_you
                  ? "bg-arcade-surface border-2 border-arcade-yellow"
                  : isPromoteZone
                    ? "bg-[#0A1F0A]"
                    : isDemoteZone
                      ? "bg-[#1F0A0A]"
                      : "bg-arcade-bg"
              }`}
            >
              {/* Bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-arcade-yellow/10"
                style={{ width: `${barWidth}%` }}
              />

              <span className={`relative font-pixel text-[8px] w-5 text-center ${
                isPromoteZone ? "text-arcade-cyan" : isDemoteZone ? "text-arcade-pink" : "text-arcade-gray"
              }`}>
                {member.rank}
              </span>
              <img
                src={member.avatar_url ?? `https://github.com/${member.github_username}.png`}
                alt={member.github_username}
                className="relative w-6 h-6 rounded-none border border-arcade-gray shrink-0"
              />
              <span className={`relative font-mono text-sm flex-1 truncate ${member.is_you ? "text-arcade-yellow font-bold" : "text-arcade-white"}`}>
                {member.github_username}
                {member.is_you && <span className="font-pixel text-[8px] text-arcade-cyan ml-1">(you)</span>}
              </span>
              <span className="relative font-pixel text-xs tabular-nums text-arcade-yellow">
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
