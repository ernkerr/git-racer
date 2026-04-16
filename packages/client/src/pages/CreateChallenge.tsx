import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import type { ChallengeType, DurationPreset, SuggestedOpponent } from "@git-racer/shared";
import { DURATION_PRESETS } from "@git-racer/shared";
import GitHubUserSearch from "../components/GitHubUserSearch.tsx";

function computePreviewEndDate(preset: DurationPreset, includeToday: boolean): string | null {
  if (preset === "ongoing") return null;
  const presetInfo = DURATION_PRESETS[preset];
  if (!presetInfo.days) return null;
  const start = new Date();
  if (!includeToday) start.setDate(start.getDate() + 1);
  start.setDate(start.getDate() + presetInfo.days - 1);
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CreateChallenge() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<ChallengeType>("1v1");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("1week");
  const [includeToday, setIncludeToday] = useState(true);
  const [opponents, setOpponents] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedOpponent[]>([]);

  useEffect(() => {
    api<SuggestedOpponent[]>("/suggested-opponents?limit=20")
      .then(setSuggested)
      .catch(() => {});
  }, []);

  // Auto-generate race name from opponents
  useEffect(() => {
    const filled = opponents.filter((o) => o.trim());
    if (filled.length > 0 && !name) {
      setName(`vs ${filled.join(", ")}`);
    }
  }, [opponents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const filteredOpponents = opponents.filter((o) => o.trim());
    if (filteredOpponents.length === 0) {
      setError("Add at least one opponent");
      setSubmitting(false);
      return;
    }

    try {
      const body = {
        name: name || `vs ${filteredOpponents.join(", ")}`,
        type,
        duration_preset: durationPreset,
        include_today: includeToday,
        opponents: filteredOpponents,
      };

      const result = await api<{ share_slug: string }>("/challenges", {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate(`/c/${result.share_slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create race");
    } finally {
      setSubmitting(false);
    }
  };

  const addOpponent = () => setOpponents([...opponents, ""]);
  const removeOpponent = (i: number) => setOpponents(opponents.filter((_, idx) => idx !== i));
  const updateOpponent = (i: number, val: string) => {
    const next = [...opponents];
    next[i] = val;
    setOpponents(next);
  };

  const selectSuggested = (username: string) => {
    const emptyIdx = opponents.findIndex((o) => !o.trim());
    if (emptyIdx >= 0) {
      updateOpponent(emptyIdx, username);
    } else if (type === "team") {
      setOpponents([...opponents, username]);
    } else {
      updateOpponent(0, username);
    }
  };

  const previewEnd = computePreviewEndDate(durationPreset, includeToday);

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-pixel text-2xl text-arcade-white mb-2">
        START A RACE
      </h1>
      <p className="font-mono text-sm text-arcade-gray mb-8">
        Pick someone to race. We'll load your real commit totals from GitHub history.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Opponent first */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            {type === "1v1" ? "Who are you racing?" : "Participants"} (GitHub username)
          </label>

          {/* Suggested opponents */}
          {suggested.length > 0 && (
            <div className="mb-3">
              <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Quick Pick</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {suggested.map((s) => (
                  <button
                    key={s.github_username}
                    type="button"
                    onClick={() => selectSuggested(s.github_username)}
                    className={`btn-arcade flex items-center gap-1.5 px-2.5 py-1.5 font-pixel text-xs shrink-0 ${
                      opponents.includes(s.github_username)
                        ? "bg-arcade-cyan/20 text-arcade-cyan"
                        : "bg-arcade-surface text-arcade-gray"
                    }`}
                    style={opponents.includes(s.github_username) ? { borderColor: "#00C853" } : undefined}
                  >
                    <img
                      src={s.avatar_url || `https://github.com/${s.github_username}.png`}
                      alt={s.github_username}
                      className="w-5 h-5 rounded-none"
                    />
                    {s.github_username}
                  </button>
                ))}
              </div>
            </div>
          )}

          {opponents.map((opp, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <div className="flex-1">
                <GitHubUserSearch
                  value={opp}
                  onChange={(val) => updateOpponent(i, val)}
                  placeholder="Search GitHub users..."
                />
              </div>
              {type === "team" && opponents.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeOpponent(i)}
                  className="font-pixel text-xs text-arcade-gray hover:text-arcade-pink px-2 transition-colors"
                >
                  X
                </button>
              )}
            </div>
          ))}
          {type === "team" && (
            <button
              type="button"
              onClick={addOpponent}
              className="font-pixel text-xs text-arcade-cyan hover:text-arcade-pink transition-colors"
            >
              + ADD PARTICIPANT
            </button>
          )}
          <p className="text-xs text-arcade-gray mt-2">
            They don't need an account — we'll track their public commits.
          </p>
        </div>

        {/* Duration */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(DURATION_PRESETS) as [DurationPreset, typeof DURATION_PRESETS[DurationPreset]][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDurationPreset(key)}
                  className={`btn-arcade py-3 font-pixel text-xs ${
                    durationPreset === key
                      ? "bg-arcade-cyan text-black"
                      : "bg-arcade-surface text-arcade-gray"
                  }`}
                >
                  {preset.label.toUpperCase()}
                </button>
              )
            )}
          </div>
          <p className="font-mono text-xs text-arcade-gray mt-2">
            {previewEnd
              ? `Ends ${previewEnd} at midnight UTC`
              : "No end date"}
          </p>
        </div>

        {/* Include today toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeToday}
              onChange={(e) => setIncludeToday(e.target.checked)}
              className="w-4 h-4 accent-[#00C853]"
            />
            <span className="font-pixel text-xs text-arcade-gray uppercase">
              Include today's commits
            </span>
          </label>
          <p className="font-mono text-[10px] text-arcade-gray mt-1 ml-7">
            {includeToday
              ? "Counts commits from the start of today (UTC)"
              : "Only counts commits starting tomorrow (UTC)"}
          </p>
        </div>

        {/* Race Type: 1v1 vs Team */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Format
          </label>
          <div className="flex gap-3">
            {(["1v1", "team"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  if (t === "1v1") setOpponents([opponents[0] || ""]);
                }}
                className={`btn-arcade flex-1 py-2 font-pixel text-xs ${
                  type === t
                    ? "bg-arcade-pink text-black"
                    : "bg-arcade-surface text-arcade-gray"
                }`}
              >
                {t === "1v1" ? "1V1" : "TEAM"}
              </button>
            ))}
          </div>
        </div>

        {/* Race Name */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Race Name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. vs torvalds"
            className="input-arcade w-full px-3 py-2"
          />
        </div>

        {error && (
          <p className="font-pixel text-xs text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-arcade w-full bg-arcade-pink text-black font-pixel text-base py-4 uppercase"
        >
          {submitting ? "STARTING..." : durationPreset === "ongoing" ? "START RACE" : "START SPRINT"}
        </button>
      </form>
    </div>
  );
}
