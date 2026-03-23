import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import type { ChallengeType, DurationType, SuggestedOpponent } from "@git-racer/shared";
import GitHubUserSearch from "../components/GitHubUserSearch.tsx";

const DURATION_LABELS: Record<DurationType, string> = {
  fixed: "FIXED",
  ongoing: "ONGOING",
  goal: "GOAL",
};

export default function CreateChallenge() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<ChallengeType>("1v1");
  const [durationType, setDurationType] = useState<DurationType>("fixed");
  const [opponents, setOpponents] = useState<string[]>([""]);
  const [endDate, setEndDate] = useState("");
  const [goalTarget, setGoalTarget] = useState(100);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedOpponent[]>([]);

  const defaultEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    api<SuggestedOpponent[]>("/suggested-opponents?limit=20")
      .then(setSuggested)
      .catch(() => {});
  }, []);

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
      const body: Record<string, unknown> = {
        name,
        type,
        duration_type: durationType,
        opponents: filteredOpponents,
      };
      if (durationType === "fixed") {
        body.end_date = new Date(endDate || defaultEnd).toISOString();
      }
      if (durationType === "goal") {
        body.goal_target = goalTarget;
        body.goal_metric = "commits";
      }

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

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-pixel text-2xl text-arcade-white mb-8">
        CREATE A RACE
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Race Name */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Race Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekend Sprint"
            required
            className="input-arcade w-full px-3 py-2"
          />
        </div>

        {/* Race Type */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Type
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

        {/* Duration Type */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            Duration
          </label>
          <div className="flex gap-3">
            {(["fixed", "ongoing", "goal"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationType(d)}
                className={`btn-arcade flex-1 py-2 font-pixel text-xs ${
                  durationType === d
                    ? "bg-arcade-pink text-black"
                    : "bg-arcade-surface text-arcade-gray"
                }`}
              >
                {DURATION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Opponents */}
        <div>
          <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
            {type === "1v1" ? "Opponent" : "Participants"} (GitHub username)
          </label>

          {/* Suggested opponents */}
          {suggested.length > 0 && (
            <div className="mb-3">
              <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">Suggested</p>
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
                    style={opponents.includes(s.github_username) ? { borderColor: "#2563EB" } : undefined}
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

        {/* End Date (fixed only) */}
        {durationType === "fixed" && (
          <div>
            <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
              End Date
            </label>
            <input
              type="date"
              value={endDate || defaultEnd}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="input-arcade w-full px-3 py-2"
            />
          </div>
        )}

        {/* Goal Target (goal only) */}
        {durationType === "goal" && (
          <div>
            <label className="block font-pixel text-xs text-arcade-gray mb-2 uppercase">
              Goal: First to ___ commits
            </label>
            <input
              type="number"
              min={1}
              value={goalTarget}
              onChange={(e) => setGoalTarget(parseInt(e.target.value) || 1)}
              className="input-arcade w-full px-3 py-2"
            />
          </div>
        )}

        {error && (
          <p className="font-pixel text-xs text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-arcade w-full bg-arcade-pink text-black font-pixel text-base py-4 uppercase"
        >
          {submitting ? "CREATING..." : "START RACE"}
        </button>
      </form>
    </div>
  );
}
