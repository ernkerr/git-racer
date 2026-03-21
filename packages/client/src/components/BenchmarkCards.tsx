import { useState } from "react";
import type { FamousDevBenchmark } from "@git-racer/shared";
import { api } from "../lib/api.ts";

const CATEGORY_LABELS: Record<string, string> = {
  legends: "Legends",
  ceos: "CEOs",
  "indie-hackers": "Indie Hackers",
  "framework-builders": "Framework Builders",
  founders: "Founders",
  "your-picks": "Your Picks",
};

const CATEGORY_ORDER = ["legends", "ceos", "indie-hackers", "framework-builders", "founders", "your-picks"];

interface Props {
  benchmarks: FamousDevBenchmark[];
  onAdded?: () => void;
  onRemoved?: (username: string) => void;
}

export default function BenchmarkCards({ benchmarks, onAdded, onRemoved }: Props) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  // Group by category
  const grouped = new Map<string, FamousDevBenchmark[]>();
  for (const b of benchmarks) {
    const cat = b.category || "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(b);
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
              (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b))
  );

  async function handleAdd() {
    const username = input.trim();
    if (!username) return;
    setAdding(true);
    try {
      await api("/benchmarks/custom", { method: "POST", body: JSON.stringify({ github_username: username }) });
      setInput("");
      onAdded?.();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(username: string) {
    try {
      await api(`/benchmarks/custom/${username}`, { method: "DELETE" });
      onRemoved?.(username);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5">
      {sortedCategories.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {grouped.get(cat)!.map((b) => (
              <div
                key={b.github_username}
                className={`flex-shrink-0 w-56 rounded-xl border p-4 ${
                  b.you_beat_them
                    ? "bg-green-600/10 border-green-500/30"
                    : "bg-gray-900 border-gray-800"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={b.avatar_url ?? `https://github.com/${b.github_username}.png`}
                    alt={b.github_username}
                    className="w-9 h-9 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{b.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">{b.known_for}</p>
                  </div>
                  {b.is_custom && (
                    <button
                      onClick={() => handleRemove(b.github_username)}
                      className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0"
                      title="Remove"
                    >
                      x
                    </button>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500">Them</p>
                    <p className="text-lg font-bold tabular-nums text-gray-400">
                      {b.their_commits}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${b.you_beat_them ? "text-green-400" : "text-gray-600"}`}>
                    {b.you_beat_them ? ">" : "<"}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">You</p>
                    <p className={`text-lg font-bold tabular-nums ${b.you_beat_them ? "text-green-400" : "text-white"}`}>
                      {b.your_commits}
                    </p>
                  </div>
                </div>

                <div className={`mt-3 text-xs font-medium text-center py-1 rounded ${
                  b.you_beat_them
                    ? "bg-green-600/20 text-green-400"
                    : "bg-gray-800 text-gray-400"
                }`}>
                  {b.you_beat_them
                    ? `You beat ${b.display_name}!`
                    : `${b.their_commits - b.your_commits} more to go`}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add developer */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a GitHub username to compare..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {adding ? "..." : "Add"}
        </button>
      </div>
    </div>
  );
}
