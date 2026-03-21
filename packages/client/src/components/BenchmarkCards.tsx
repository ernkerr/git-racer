import type { FamousDevBenchmark } from "@git-racer/shared";

interface Props {
  benchmarks: FamousDevBenchmark[];
}

export default function BenchmarkCards({ benchmarks }: Props) {
  if (benchmarks.length === 0) {
    return (
      <div className="text-gray-500 text-center py-6 text-sm">
        Benchmark data populates as contributions are tracked. Check back soon!
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {benchmarks.slice(0, 10).map((b) => (
        <div
          key={b.github_username}
          className={`flex-shrink-0 w-64 rounded-xl border p-4 ${
            b.you_beat_them
              ? "bg-green-600/10 border-green-500/30"
              : "bg-gray-900 border-gray-800"
          }`}
        >
          {/* Dev info */}
          <div className="flex items-center gap-3 mb-3">
            <img
              src={b.avatar_url ?? `https://github.com/${b.github_username}.png`}
              alt={b.github_username}
              className="w-10 h-10 rounded-full"
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{b.display_name}</p>
              <p className="text-xs text-gray-500 truncate">{b.known_for}</p>
            </div>
          </div>

          {/* Comparison */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500">Their commits</p>
              <p className="text-lg font-bold tabular-nums text-gray-400">
                {b.their_commits}
              </p>
            </div>
            <div className="text-center px-2">
              <span className={`text-lg font-bold ${b.you_beat_them ? "text-green-400" : "text-gray-500"}`}>
                {b.you_beat_them ? ">" : "<"}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">You</p>
              <p className={`text-lg font-bold tabular-nums ${b.you_beat_them ? "text-green-400" : "text-white"}`}>
                {b.your_commits}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className={`mt-3 text-xs font-medium text-center py-1 rounded ${
            b.you_beat_them
              ? "bg-green-600/20 text-green-400"
              : "bg-gray-800 text-gray-400"
          }`}>
            {b.you_beat_them
              ? `You beat the ${b.known_for}!`
              : `${b.their_commits - b.your_commits} more to beat them`}
          </div>
        </div>
      ))}
    </div>
  );
}
