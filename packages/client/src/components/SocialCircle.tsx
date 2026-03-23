import type { SocialCircleData } from "@git-racer/shared";

interface Props {
  data: SocialCircleData;
  loading: boolean;
}

export default function SocialCircle({ data, loading }: Props) {
  if (loading) {
    return <div className="font-pixel text-xs text-arcade-gray text-center py-6 blink">LOADING CIRCLE...</div>;
  }

  if (data.total === 0) {
    return (
      <div className="font-pixel text-xs text-arcade-gray text-center py-6">
        FOLLOW PEOPLE ON GITHUB TO SEE HOW YOU COMPARE!
      </div>
    );
  }

  return (
    <div>
      {/* Your rank badge */}
      <div className="retro-box bg-arcade-surface p-4 mb-3 text-center">
        <p className="font-pixel text-2xl text-arcade-cyan" style={{ textShadow: "2px 2px 0px #000" }}>
          #{data.your_rank}
        </p>
        <p className="font-mono text-xs text-arcade-gray mt-1">
          of {data.total} devs you follow
        </p>
      </div>

      {/* Ranked list */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {data.entries.map((entry) => (
          <div
            key={entry.github_username}
            className={`flex items-center gap-3 px-3 py-2 text-sm ${
              entry.is_you
                ? "bg-arcade-surface border border-arcade-cyan"
                : "bg-arcade-bg"
            }`}
          >
            <span className="font-pixel text-[8px] w-5 text-center text-arcade-gray">
              {entry.rank}
            </span>
            <img
              src={entry.avatar_url ?? `https://github.com/${entry.github_username}.png`}
              alt={entry.github_username}
              className="w-6 h-6 rounded-none border border-arcade-gray shrink-0"
            />
            <span className={`font-mono text-sm flex-1 truncate ${entry.is_you ? "text-arcade-yellow font-bold" : "text-arcade-white"}`}>
              {entry.github_username}
              {entry.is_you && <span className="font-pixel text-[8px] text-arcade-cyan ml-1">(you)</span>}
            </span>
            <span className="font-pixel text-xs tabular-nums text-arcade-yellow">
              {entry.commit_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
