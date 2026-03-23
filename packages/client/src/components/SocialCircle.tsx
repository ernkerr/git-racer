import type { SocialCircleData } from "@git-racer/shared";

interface Props {
  data: SocialCircleData;
  loading: boolean;
}

export default function SocialCircle({ data, loading }: Props) {
  if (loading) {
    return <div className="font-pixel text-sm text-arcade-gray text-center py-6">LOADING CIRCLE...</div>;
  }

  if (data.total === 0) {
    return (
      <div className="font-pixel text-sm text-arcade-gray text-center py-6">
        FOLLOW PEOPLE ON GITHUB TO SEE HOW YOU COMPARE!
      </div>
    );
  }

  return (
    <div>
      {/* Your rank badge */}
      <div className="retro-box bg-arcade-surface p-4 mb-3 text-center">
        <p className="font-pixel text-3xl text-arcade-cyan">
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
            className={`flex items-center gap-3 px-3 py-2 text-sm border-2 ${
              entry.is_you
                ? "bg-arcade-surface border-black"
                : "bg-arcade-bg border-transparent"
            }`}
          >
            <span className="font-pixel text-xs w-5 text-center text-arcade-gray">
              {entry.rank}
            </span>
            <img
              src={entry.avatar_url ?? `https://github.com/${entry.github_username}.png`}
              alt={entry.github_username}
              className="w-6 h-6 rounded-none border-2 border-black shrink-0"
            />
            <span className={`font-mono text-sm flex-1 truncate ${entry.is_you ? "text-arcade-white font-bold" : "text-arcade-white"}`}>
              {entry.github_username}
              {entry.is_you && <span className="font-pixel text-xs text-arcade-cyan ml-1">(you)</span>}
            </span>
            <span className="font-pixel text-sm tabular-nums text-arcade-white">
              {entry.commit_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
