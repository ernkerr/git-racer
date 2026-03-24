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
    <div className="space-y-6">
      {/* Head-to-head matchups */}
      {starred.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {starred.map((s) => {
            const total = s.your_commits + s.their_commits;
            const youPct = total > 0 ? (s.your_commits / total) * 100 : 50;
            const winning = s.your_commits > s.their_commits;
            const diff = Math.abs(s.your_commits - s.their_commits);

            return (
              <div
                key={s.github_username}
                className="retro-box bg-arcade-surface p-4 group"
              >
                {/* Opponent row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                      alt={s.github_username}
                      className="w-7 h-7 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-pixel text-xs text-arcade-white truncate block leading-tight">
                        {s.display_name || s.github_username}
                      </span>
                      <span className="font-mono text-[10px] text-arcade-gray leading-tight">
                        @{s.github_username}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnstar(s.github_username)}
                    className="text-arcade-gray hover:text-arcade-red transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Score comparison */}
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <span className="font-pixel text-lg tabular-nums" style={{
                      color: winning ? "var(--green)" : s.tied ? "var(--yellow)" : "var(--text)",
                    }}>
                      {s.your_commits.toLocaleString()}
                    </span>
                    <span className="font-mono text-[10px] text-arcade-gray ml-1.5">you</span>
                  </div>
                  <span className="font-mono text-[10px]" style={{
                    color: s.tied ? "var(--yellow)" : winning ? "var(--green)" : "var(--muted)",
                  }}>
                    {s.tied ? "tied" : winning ? `+${diff.toLocaleString()}` : `-${diff.toLocaleString()}`}
                  </span>
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-arcade-gray mr-1.5">them</span>
                    <span className="font-pixel text-lg tabular-nums text-arcade-white">
                      {s.their_commits.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 flex rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${youPct}%`,
                      background: winning ? "var(--green)" : s.tied ? "var(--yellow)" : "var(--muted)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + Famous dev suggestions */}
      <div>
        <div className="max-w-md mb-3">
          <GitHubUserSearch
            value={searchValue}
            onChange={setSearchValue}
            onSelect={(username) => handleRace(username)}
            placeholder="Search any GitHub user to race..."
          />
        </div>

        {suggestions.length > 0 && (
          <>
            <p className="font-pixel text-xs text-arcade-gray uppercase tracking-wider mb-3">Race a famous dev</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {suggestions.map((s) => (
                <button
                  key={s.github_username}
                  onClick={() => handleRace(s.github_username)}
                  disabled={adding}
                  className="retro-box bg-arcade-surface p-3 text-left hover:bg-arcade-hover transition-colors disabled:opacity-50 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <img
                      src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                      alt={s.github_username}
                      className="w-7 h-7 rounded-full shrink-0"
                    />
                    <span className="font-pixel text-xs text-arcade-white truncate leading-tight">{s.display_name}</span>
                  </div>
                  <p className="font-mono text-[10px] text-arcade-gray leading-snug mb-2 line-clamp-1">{s.known_for}</p>
                  <span className="font-pixel text-[10px] text-arcade-gray group-hover:text-arcade-green transition-colors">
                    RACE →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Empty state */}
      {showEmpty && !hasContent && (
        <div className="retro-box bg-arcade-surface p-8 text-center space-y-3">
          <p className="font-pixel text-sm text-arcade-gray">No races yet</p>
          <p className="font-mono text-xs text-arcade-gray">Search for a GitHub user to start your first race.</p>
        </div>
      )}
    </div>
  );
}
