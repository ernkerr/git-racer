import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StarredUser, StarSuggestion } from "@git-racer/shared";
import { api } from "../lib/api.ts";
import GitHubUserSearch from "./GitHubUserSearch.tsx";
import RaceTrack from "./RaceTrack.tsx";

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
  const [pendingDelete, setPendingDelete] = useState<{
    username: string;
    displayName: string;
    shareSlug: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleConfirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await api(`/challenges/${pendingDelete.shareSlug}`, { method: "DELETE" });
      await api(`/starred/${pendingDelete.username}`, { method: "DELETE" });
      onUnstar(pendingDelete.username);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const hasContent = starred.length > 0 || suggestions.length > 0;

  return (
    <div className="space-y-6">
      {/* Head-to-head matchups */}
      {starred.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {starred.map((s) => {
            return (
              <div
                key={s.github_username}
                onClick={() => s.share_slug && navigate(`/c/${s.share_slug}`)}
                className={`retro-box bg-arcade-surface p-4 group ${s.share_slug ? "cursor-pointer hover:bg-arcade-hover transition-colors" : ""}`}
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
                      {s.known_for && (
                        <span className="font-mono text-[10px] text-arcade-gray leading-tight block">
                          {s.known_for}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete({
                        username: s.github_username,
                        displayName: s.display_name || s.github_username,
                        shareSlug: s.share_slug ?? "",
                      });
                    }}
                    className="text-arcade-gray hover:text-arcade-red transition-colors opacity-0 group-hover:opacity-100"
                    title="End race"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Race track */}
                <RaceTrack
                  yourCommits={s.your_commits}
                  theirCommits={s.their_commits}
                />
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

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            className="retro-box bg-arcade-surface p-6 max-w-sm mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-pixel text-sm text-arcade-white">END RACE</h3>
            <p className="font-mono text-xs text-arcade-gray">
              Are you sure you want to end the race against{" "}
              <span className="text-arcade-white">{pendingDelete.displayName}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="font-pixel text-xs text-arcade-gray hover:text-arcade-white transition-colors px-3 py-1.5 disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="font-pixel text-xs bg-arcade-red/20 text-arcade-red hover:bg-arcade-red/30 transition-colors px-3 py-1.5 rounded border border-arcade-red/40 disabled:opacity-50"
              >
                {deleting ? "ENDING..." : "END RACE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
