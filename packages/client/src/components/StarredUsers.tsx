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

function CommitBar({ you, them }: { you: number; them: number }) {
  const max = Math.max(you, them, 1);
  const youPct = Math.max((you / max) * 100, 2);
  const themPct = Math.max((them / max) * 100, 2);
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="font-mono text-[11px] tabular-nums text-arcade-gray w-10 text-right shrink-0">{them.toLocaleString()}</span>
      <div className="flex-1 flex items-center gap-1 h-3">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${themPct}%`, background: "var(--border)" }}
        />
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${youPct}%`,
            background: you > them ? "var(--green)" : you === them ? "var(--yellow)" : "var(--border)",
          }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums w-10 shrink-0" style={{
        color: you > them ? "var(--green)" : you === them ? "var(--yellow)" : "var(--text)",
      }}>{you.toLocaleString()}</span>
    </div>
  );
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
    <div className="space-y-4">
      {/* Starred devs — clean table-like rows */}
      {starred.length > 0 && (
        <div className="retro-box bg-arcade-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="font-pixel text-[10px] text-arcade-gray uppercase tracking-wider">Head-to-head · this week</span>
            <div className="flex items-center gap-6">
              <span className="font-pixel text-[10px] text-arcade-gray uppercase tracking-wider">Them</span>
              <span className="font-pixel text-[10px] text-arcade-gray uppercase tracking-wider" style={{ minWidth: "2.5rem" }}>You</span>
            </div>
          </div>

          {starred.map((s, i) => {
            const diff = s.your_commits - s.their_commits;
            const statusLabel = s.tied ? "Tied" : diff > 0 ? `+${diff.toLocaleString()}` : `${diff.toLocaleString()}`;
            const statusColor = s.tied ? "var(--yellow)" : s.you_beat_them ? "var(--green)" : "var(--muted)";
            return (
              <div
                key={s.github_username}
                className="group"
                style={i < starred.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                      alt={s.github_username}
                      className="w-8 h-8 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-pixel text-sm text-arcade-white truncate block">{s.display_name || s.github_username}</span>
                      <span className="font-mono text-[11px] text-arcade-gray">@{s.github_username}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full" style={{ color: statusColor, background: "var(--surface2)" }}>
                      {statusLabel}
                    </span>
                    <button
                      onClick={() => handleUnstar(s.github_username)}
                      className="text-arcade-gray hover:text-arcade-red transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-3 -mt-1">
                  <CommitBar you={s.your_commits} them={s.their_commits} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Famous dev suggestions — compact list */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-4">
            <p className="font-pixel text-xs text-arcade-gray uppercase tracking-wider shrink-0">Race a famous dev</p>
            <div className="w-56">
              <GitHubUserSearch
                value={searchValue}
                onChange={setSearchValue}
                onSelect={(username) => handleRace(username)}
                placeholder="or search any user..."
              />
            </div>
          </div>
          <div className="retro-box bg-arcade-surface overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={s.github_username}
                onClick={() => handleRace(s.github_username)}
                disabled={adding}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-arcade-hover transition-colors disabled:opacity-50 cursor-pointer"
                style={i < suggestions.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
              >
                <img
                  src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                  alt={s.github_username}
                  className="w-8 h-8 rounded-full shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-sm text-arcade-white truncate">{s.display_name}</span>
                    <span className="font-mono text-[11px] text-arcade-gray truncate">{s.known_for}</span>
                  </div>
                  {s.commit_count > 0 && (
                    <span className="font-mono text-[11px] text-arcade-gray">{s.commit_count.toLocaleString()} commits this week</span>
                  )}
                </div>
                <span className="font-pixel text-[11px] text-arcade-gray group-hover:text-arcade-white shrink-0">RACE →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {showEmpty && !hasContent && (
        <div className="retro-box bg-arcade-surface p-8 text-center space-y-3">
          <p className="font-pixel text-sm text-arcade-gray">No races yet</p>
          <p className="font-mono text-xs text-arcade-gray">Search for a GitHub user to start your first race.</p>
          <div className="max-w-sm mx-auto">
            <GitHubUserSearch
              value={searchValue}
              onChange={setSearchValue}
              onSelect={(username) => handleRace(username)}
              placeholder="Search GitHub users..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
