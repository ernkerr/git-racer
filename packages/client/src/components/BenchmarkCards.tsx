import { useState } from "react";
import type { FamousDevBenchmark } from "@git-racer/shared";
import { api } from "../lib/api.ts";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  legends: "Legends",
  ceos: "CEOs",
  "indie-hackers": "Indie Hackers",
  "framework-builders": "Frameworks",
  founders: "Founders",
  "your-picks": "Your Picks",
};

const CATEGORY_ORDER = ["all", "legends", "ceos", "indie-hackers", "framework-builders", "founders", "your-picks"];

interface Props {
  benchmarks: FamousDevBenchmark[];
  onAdded?: () => void;
  onRemoved?: (username: string) => void;
}

export default function BenchmarkCards({ benchmarks, onAdded, onRemoved }: Props) {
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  const categories = new Set(benchmarks.map((b) => b.category || "other"));
  const tabs = CATEGORY_ORDER.filter((c) => c === "all" || categories.has(c));

  const filtered = filter === "all"
    ? benchmarks
    : benchmarks.filter((b) => (b.category || "other") === filter);

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

  if (benchmarks.length === 0) {
    return (
      <div className="text-gray-500 text-center py-6 text-sm">
        Benchmark data populates as contributions are tracked. Check back soon!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-white text-black"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Horizontal scroll of cards — original card layout */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {filtered.map((b) => (
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
                ? `You beat ${b.display_name}!`
                : `${b.their_commits - b.your_commits} more to beat them`}
            </div>
          </div>
        ))}
      </div>

      {/* Add developer */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a GitHub username..."
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
