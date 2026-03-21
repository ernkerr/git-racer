import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import type { ChallengeType, DurationType, SuggestedOpponent } from "@git-racer/shared";
import GitHubUserSearch from "../components/GitHubUserSearch.tsx";

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
    // Fill the first empty slot, or add a new one
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
      <h1 className="text-2xl font-bold mb-6">Create a Race</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Race Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekend Sprint"
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Race Type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Type</label>
          <div className="flex gap-3">
            {(["1v1", "team"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  if (t === "1v1") setOpponents([opponents[0] || ""]);
                }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === t
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {t === "1v1" ? "1v1" : "Team"}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Duration</label>
          <div className="flex gap-3">
            {(["fixed", "ongoing", "goal"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationType(d)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  durationType === d
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {d === "fixed" ? "End Date" : d === "ongoing" ? "Ongoing" : "Goal"}
              </button>
            ))}
          </div>
        </div>

        {/* Opponents */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            {type === "1v1" ? "Opponent" : "Participants"} (GitHub username)
          </label>

          {/* Suggested opponents */}
          {suggested.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">Suggested</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {suggested.map((s) => (
                  <button
                    key={s.github_username}
                    type="button"
                    onClick={() => selectSuggested(s.github_username)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                      opponents.includes(s.github_username)
                        ? "bg-green-600/20 border border-green-500/40 text-green-400"
                        : "bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <img
                      src={s.avatar_url || `https://github.com/${s.github_username}.png`}
                      alt={s.github_username}
                      className="w-5 h-5 rounded-full"
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
                  className="text-gray-500 hover:text-red-400 px-2 transition-colors"
                >
                  x
                </button>
              )}
            </div>
          ))}
          {type === "team" && (
            <button
              type="button"
              onClick={addOpponent}
              className="text-sm text-green-400 hover:text-green-300"
            >
              + Add participant
            </button>
          )}
          <p className="text-xs text-gray-500 mt-1">
            They don't need an account — we'll track their public commits.
          </p>
        </div>

        {/* End Date (fixed only) */}
        {durationType === "fixed" && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate || defaultEnd}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-green-500"
            />
          </div>
        )}

        {/* Goal Target (goal only) */}
        {durationType === "goal" && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Goal: First to ___ commits
            </label>
            <input
              type="number"
              min={1}
              value={goalTarget}
              onChange={(e) => setGoalTarget(parseInt(e.target.value) || 1)}
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-green-500"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 py-2.5 rounded-md font-semibold transition-colors"
        >
          {submitting ? "Creating..." : "Start Race"}
        </button>
      </form>
    </div>
  );
}
