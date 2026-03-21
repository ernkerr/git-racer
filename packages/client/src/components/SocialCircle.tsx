import type { SocialCircleData } from "@git-racer/shared";

interface Props {
  data: SocialCircleData;
  loading: boolean;
}

export default function SocialCircle({ data, loading }: Props) {
  if (loading) {
    return <div className="text-gray-400 text-center py-6 text-sm">Loading your circle...</div>;
  }

  if (data.total === 0) {
    return (
      <div className="text-gray-500 text-center py-6 text-sm">
        Follow people on GitHub to see how you compare!
      </div>
    );
  }

  return (
    <div>
      {/* Your rank badge */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-3 text-center">
        <p className="text-3xl font-bold text-green-400">#{data.your_rank}</p>
        <p className="text-sm text-gray-400">
          of {data.total} devs you follow
        </p>
      </div>

      {/* Ranked list */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {data.entries.map((entry) => (
          <div
            key={entry.github_username}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              entry.is_you
                ? "bg-green-600/20 border border-green-500/40"
                : "bg-gray-900/50"
            }`}
          >
            <span className="w-5 text-center font-bold text-xs text-gray-500">
              {entry.rank}
            </span>
            <img
              src={entry.avatar_url ?? `https://github.com/${entry.github_username}.png`}
              alt={entry.github_username}
              className="w-6 h-6 rounded-full flex-shrink-0"
            />
            <span className={`flex-1 truncate ${entry.is_you ? "font-semibold text-white" : "text-gray-300"}`}>
              {entry.github_username}
              {entry.is_you && <span className="text-green-400 text-xs ml-1">(you)</span>}
            </span>
            <span className="font-bold tabular-nums text-green-400">
              {entry.commit_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
