import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StarredUser, StarSuggestion } from "@git-racer/shared";
import { api } from "../lib/api.ts";
import GitHubUserSearch from "./GitHubUserSearch.tsx";

interface Props {
  starred: StarredUser[];
  suggestions: StarSuggestion[];
  onStar: (username: string) => void;
  onUnstar: (username: string) => void;
  showEmpty?: boolean;
}

export default function StarredUsers({ starred, suggestions, onStar, onUnstar, showEmpty }: Props) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleRace(username: string) {
    if (adding) return;
    setAdding(true);
    try {
      await api("/starred", {
        method: "POST",
        body: JSON.stringify({ github_username: username }),
      });
      const result = await api<{ share_slug: string }>("/challenges", {
        method: "POST",
        body: JSON.stringify({
          name: `vs ${username}`,
          type: "1v1",
          duration_type: "ongoing",
          opponents: [username],
        }),
      });
      onStar(username);
      setSearchValue("");
      navigate(`/c/${result.share_slug}`);
    } catch {
      onStar(username);
      setSearchValue("");
    } finally {
      setAdding(false);
    }
  }

  async function handleUnstar(username: string) {
    try {
      await api(`/starred/${username}`, { method: "DELETE" });
      onUnstar(username);
    } catch {
      // ignore
    }
  }

  const hasContent = starred.length > 0 || suggestions.length > 0;

  return (
    <div className="space-y-3">
      {/* Search bar — always first */}
      <GitHubUserSearch
        value={searchValue}
        onChange={setSearchValue}
        onSelect={(username) => handleRace(username)}
        placeholder="Search any GitHub user to race..."
      />

      {/* Starred devs as race cards */}
      {starred.map((s) => {
        // Muted amber when losing instead of alarming red
        const statusColor = s.tied ? "#EAB308" : s.you_beat_them ? "#16A34A" : "#B45309";
        return (
          <div
            key={s.github_username}
            className="retro-box bg-arcade-surface p-4"
            style={{ borderColor: statusColor }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                  alt={s.github_username}
                  className="w-10 h-10 rounded-none border-3 border-arcade-border shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-arcade-white truncate">{s.display_name || s.github_username}</span>
                    <span
                      className="font-pixel text-[10px] px-1.5 py-0.5 border-2 shrink-0"
                      style={{ borderColor: "#00C853", color: "#00C853" }}
                    >
                      RACE
                    </span>
                  </div>
                  <p className="font-mono text-xs text-arcade-gray">@{s.github_username}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 ml-4">
                {/* Commit comparison */}
                <div className="text-center">
                  <p className="font-pixel text-[10px] text-arcade-gray mb-0.5">THEM</p>
                  <p className="font-pixel text-xl tabular-nums text-arcade-white">{s.their_commits.toLocaleString()}</p>
                </div>
                <span className="font-pixel text-base" style={{ color: statusColor }}>
                  {s.tied ? "=" : s.you_beat_them ? ">" : "<"}
                </span>
                <div className="text-center">
                  <p className="font-pixel text-[10px] text-arcade-gray mb-0.5">YOU</p>
                  <p className="font-pixel text-xl tabular-nums" style={{ color: s.you_beat_them ? "#00C853" : "var(--arcade-white)" }}>
                    {s.your_commits.toLocaleString()}
                  </p>
                </div>

                {/* Unstar */}
                <button
                  onClick={() => handleUnstar(s.github_username)}
                  className="text-arcade-gray hover:text-arcade-pink transition-colors ml-2"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <p className="font-pixel text-xs mt-2" style={{ color: statusColor }}>
              {s.tied
                ? "TIED"
                : s.you_beat_them
                ? `YOU LEAD BY ${(s.your_commits - s.their_commits).toLocaleString()}`
                : `${(s.their_commits - s.your_commits).toLocaleString()} MORE TO BEAT`}
            </p>
          </div>
        );
      })}

      {/* Suggestions — famous devs shown as full cards */}
      {suggestions.length > 0 && (
        <div>
          <p className="font-pixel text-xs text-arcade-gray mb-3 uppercase">Race a Famous Dev</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {suggestions.map((s) => (
              <button
                key={s.github_username}
                onClick={() => handleRace(s.github_username)}
                disabled={adding}
                className="retro-box bg-arcade-surface p-4 text-left hover:border-arcade-pink transition-all disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                    alt={s.github_username}
                    className="w-10 h-10 rounded-none border-3 border-arcade-border shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-pixel text-sm text-arcade-white truncate">{s.display_name}</p>
                    <p className="font-mono text-xs text-arcade-gray">@{s.github_username}</p>
                  </div>
                </div>
                <p className="font-mono text-xs text-arcade-gray mb-3">{s.known_for}</p>
                <div className="flex items-center justify-between">
                  {s.commit_count > 0 ? (
                    <p className="font-pixel text-xs tabular-nums text-arcade-white">{s.commit_count.toLocaleString()} commits</p>
                  ) : (
                    <span />
                  )}
                  <span
                    className="font-pixel text-xs px-2 py-1 border-2"
                    style={{ borderColor: "#00C853", color: "#00C853" }}
                  >
                    RACE
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — only shown when no races exist either */}
      {showEmpty && !hasContent && (
        <div className="retro-box bg-arcade-surface p-8 text-center">
          <p className="font-pixel text-sm text-arcade-gray mb-2">NO RACES YET.</p>
          <p className="font-mono text-xs text-arcade-gray">Search above to race any GitHub user.</p>
        </div>
      )}
    </div>
  );
}
