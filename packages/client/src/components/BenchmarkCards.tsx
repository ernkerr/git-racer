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

  // Which category tabs to show (only ones that have data)
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

  return (
    <div className="space-y-3">
      {/* Category tabs */}
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

      {/* Single horizontal scroll of compact cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {filtered.map((b) => (
          <div
            key={b.github_username}
            className={`flex-shrink-0 flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
              b.you_beat_them
                ? "bg-green-600/10 border-green-500/30"
                : "bg-gray-900 border-gray-800"
            }`}
          >
            <img
              src={b.avatar_url ?? `https://github.com/${b.github_username}.png`}
              alt={b.github_username}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{b.display_name}</p>
              <p className="text-[10px] text-gray-500 truncate">{b.known_for}</p>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800 ml-1">
              <div className="text-right">
                <p className="text-xs font-bold tabular-nums text-gray-400">{b.their_commits}</p>
                <p className="text-[9px] text-gray-600">them</p>
              </div>
              <span className={`text-sm font-bold ${b.you_beat_them ? "text-green-400" : "text-gray-600"}`}>
                {b.you_beat_them ? ">" : "<"}
              </span>
              <div>
                <p className={`text-xs font-bold tabular-nums ${b.you_beat_them ? "text-green-400" : "text-white"}`}>{b.your_commits}</p>
                <p className="text-[9px] text-gray-600">you</p>
              </div>
            </div>
            {b.is_custom && (
              <button
                onClick={() => handleRemove(b.github_username)}
                className="text-gray-600 hover:text-red-400 text-xs ml-1"
                title="Remove"
              >
                x
              </button>
            )}
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
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          {adding ? "..." : "Add"}
        </button>
      </div>
    </div>
  );
}
