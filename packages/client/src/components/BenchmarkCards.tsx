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
      <div className="font-pixel text-sm text-arcade-gray text-center py-6">
        BENCHMARK DATA POPULATES AS CONTRIBUTIONS ARE TRACKED. CHECK BACK SOON!
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
            className={`btn-arcade shrink-0 px-3 py-1 font-pixel text-xs transition-colors ${
              filter === cat
                ? "bg-arcade-pink text-black"
                : "bg-arcade-surface text-arcade-gray"
            }`}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Horizontal scroll of cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {filtered.map((b) => (
          <div
            key={b.github_username}
            className={`retro-box shrink-0 w-64 bg-arcade-surface p-4 ${
              b.you_beat_them ? "border-arcade-cyan" : ""
            }`}
            style={b.you_beat_them ? { borderColor: "#2563EB" } : undefined}
          >
            {/* Dev info */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src={b.avatar_url ?? `https://github.com/${b.github_username}.png`}
                alt={b.github_username}
                className="w-10 h-10 rounded-none border-2 border-black shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-arcade-white truncate">{b.display_name}</p>
                <p className="font-mono text-xs text-arcade-gray truncate">{b.known_for}</p>
              </div>
              {b.is_custom && (
                <button
                  onClick={() => handleRemove(b.github_username)}
                  className="font-pixel text-xs text-arcade-gray hover:text-arcade-pink shrink-0 transition-colors"
                  title="Remove"
                >
                  X
                </button>
              )}
            </div>

            {/* Comparison */}
            <div className="flex items-end justify-between">
              <div>
                <p className="font-pixel text-xs text-arcade-gray mb-1">THEIRS</p>
                <p className="font-pixel text-base tabular-nums text-arcade-gray">
                  {b.their_commits}
                </p>
              </div>
              <div className="text-center px-2">
                <span className={`font-pixel text-base ${b.you_beat_them ? "text-arcade-cyan" : "text-arcade-gray"}`}>
                  {b.you_beat_them ? ">" : "<"}
                </span>
              </div>
              <div className="text-right">
                <p className="font-pixel text-xs text-arcade-gray mb-1">YOU</p>
                <p className={`font-pixel text-base tabular-nums ${b.you_beat_them ? "text-arcade-pink" : "text-arcade-white"}`}>
                  {b.your_commits}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className={`mt-3 font-pixel text-xs text-center py-1 border-3 ${
              b.you_beat_them
                ? "border-arcade-cyan text-arcade-cyan bg-arcade-bg"
                : "border-black text-arcade-gray bg-arcade-bg"
            }`}>
              {b.you_beat_them
                ? `BEAT ${b.display_name.toUpperCase()}!`
                : `${b.their_commits - b.your_commits} MORE TO BEAT`}
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
          className="input-arcade flex-1 px-3 py-2 text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="btn-arcade bg-arcade-surface text-arcade-gray font-pixel text-xs px-4 py-2 disabled:opacity-40"
        >
          {adding ? "..." : "ADD"}
        </button>
      </div>
    </div>
  );
}
