import { useState } from "react";
import type { StarredUser, StarSuggestion } from "@git-racer/shared";
import { api } from "../lib/api.ts";
import GitHubUserSearch from "./GitHubUserSearch.tsx";

interface Props {
  starred: StarredUser[];
  suggestions: StarSuggestion[];
  onStar: (username: string) => void;
  onUnstar: (username: string) => void;
}

export default function StarredUsers({ starred, suggestions, onStar, onUnstar }: Props) {
  const [searchValue, setSearchValue] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleRace(username: string) {
    if (adding) return;
    setAdding(true);
    try {
      // Star the user
      await api("/starred", {
        method: "POST",
        body: JSON.stringify({ github_username: username }),
      });

      // Create a 1v1 ongoing race
      await api<{ share_slug: string }>("/challenges", {
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

  return (
    <div className="space-y-4">
      {/* Starred users comparison cards */}
      {starred.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {starred.map((s) => (
            <div
              key={s.github_username}
              className="retro-box shrink-0 w-64 bg-arcade-surface p-4"
              style={s.you_beat_them ? { borderColor: "#00F5FF" } : undefined}
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                  alt={s.github_username}
                  className="w-10 h-10 rounded-none border border-arcade-gray shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-arcade-white truncate">{s.display_name}</p>
                  <p className="font-mono text-xs text-arcade-gray truncate">@{s.github_username}</p>
                </div>
                <button
                  onClick={() => handleUnstar(s.github_username)}
                  className="text-arcade-yellow hover:text-arcade-gray shrink-0 transition-colors"
                  title="Unstar"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="font-pixel text-[8px] text-arcade-gray mb-1">THEM</p>
                  <p className="font-pixel text-sm tabular-nums text-arcade-gray">
                    {s.their_commits.toLocaleString()}
                  </p>
                </div>
                <div className="text-center px-2">
                  <span className={`font-pixel text-sm ${s.you_beat_them ? "text-arcade-cyan" : "text-arcade-gray"}`}>
                    {s.you_beat_them ? ">" : "<"}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-pixel text-[8px] text-arcade-gray mb-1">YOU</p>
                  <p className={`font-pixel text-sm tabular-nums ${s.you_beat_them ? "text-arcade-yellow" : "text-arcade-white"}`}>
                    {s.your_commits.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className={`mt-3 font-pixel text-[8px] text-center py-1 border ${
                s.you_beat_them
                  ? "border-arcade-cyan text-arcade-cyan bg-arcade-bg"
                  : "border-arcade-gray text-arcade-gray bg-arcade-bg"
              }`}>
                {s.you_beat_them
                  ? `YOU BEAT ${s.display_name.toUpperCase()}!`
                  : `${(s.their_commits - s.your_commits).toLocaleString()} MORE TO BEAT`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <p className="font-pixel text-[8px] text-arcade-gray mb-2 uppercase">Suggested</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <button
                key={s.github_username}
                onClick={() => handleRace(s.github_username)}
                disabled={adding}
                className="btn-arcade flex items-center gap-2 shrink-0 bg-arcade-surface px-3 py-2 disabled:opacity-50"
              >
                <img
                  src={s.avatar_url ?? `https://github.com/${s.github_username}.png`}
                  alt={s.github_username}
                  className="w-6 h-6 rounded-none border border-arcade-gray"
                />
                <span className="font-mono text-sm text-arcade-white truncate max-w-[100px]">{s.github_username}</span>
                <span className="font-pixel text-[8px] text-arcade-cyan">RACE</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search to race anyone */}
      <div>
        <GitHubUserSearch
          value={searchValue}
          onChange={(username) => {
            setSearchValue(username);
            if (username && username.length > 2 && !username.includes(" ")) {
              handleRace(username);
            }
          }}
          placeholder="Search for a GitHub user to race..."
        />
      </div>
    </div>
  );
}
