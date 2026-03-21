import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { CHALLENGE_REFRESH_MS } from "@git-racer/shared";
import type { ChallengeWithLeaderboard } from "@git-racer/shared";

export default function Challenge() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeWithLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchChallenge = async () => {
    try {
      const data = await api<ChallengeWithLeaderboard>(`/challenges/${slug}`);
      setChallenge(data);
    } catch {
      // Challenge not found
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenge();
    const interval = setInterval(fetchChallenge, CHALLENGE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [slug]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await api(`/challenges/${slug}/join`, { method: "POST" });
      await fetchChallenge();
    } catch {
      // Already joined or error
    } finally {
      setJoining(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-gray-400">Loading race...</div>;
  if (!challenge) return <div className="text-gray-400">Race not found.</div>;

  const isParticipant = user && challenge.participants.some(
    (p) => p.github_username === user.github_username
  );
  const isFinished = challenge.end_date && new Date(challenge.end_date) < new Date();
  const isGoal = challenge.duration_type === "goal";
  const goalReached = isGoal && challenge.goal_target &&
    challenge.participants.some((p) => p.commit_count >= challenge.goal_target!);
  const canJoin = user && !isParticipant && !isFinished && !goalReached && challenge.type === "team";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{challenge.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
              {challenge.type}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {new Date(challenge.start_date).toLocaleDateString()} &mdash;{" "}
            {challenge.end_date
              ? new Date(challenge.end_date).toLocaleDateString()
              : isGoal
              ? `First to ${challenge.goal_target} ${challenge.goal_metric}`
              : "Ongoing"}
            {(isFinished || goalReached) && (
              <span className="ml-2 text-yellow-400 font-medium">Finished</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canJoin && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-1.5 rounded-md transition-colors"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          )}
          <button
            onClick={copyLink}
            className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-md transition-colors"
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>

      {/* Goal progress bar */}
      {isGoal && challenge.goal_target && challenge.participants.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2">
            Goal: {challenge.goal_target} {challenge.goal_metric}
          </p>
          {challenge.participants.slice(0, 3).map((p) => {
            const pct = Math.min(100, (p.commit_count / challenge.goal_target!) * 100);
            return (
              <div key={p.github_username} className="mb-2 last:mb-0">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{p.github_username}</span>
                  <span>{p.commit_count} / {challenge.goal_target}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 text-sm text-gray-400 border-b border-gray-800">
          <span>#</span>
          <span>Developer</span>
          <span>Commits</span>
        </div>
        {challenge.participants.map((p, i) => (
          <div
            key={p.github_username}
            className={`grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 items-center ${
              i === 0 ? "bg-gray-800/50" : ""
            } ${
              user?.github_username === p.github_username
                ? "border-l-2 border-green-500"
                : ""
            }`}
          >
            <span className="text-gray-500 font-mono w-6 text-center">
              {i + 1}
            </span>
            <div className="flex items-center gap-3">
              <img
                src={p.avatar_url || `https://github.com/${p.github_username}.png`}
                alt={p.github_username}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium">
                {p.github_username}
                {p.is_ghost && (
                  <span className="ml-1.5 text-xs text-gray-500">(public)</span>
                )}
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {p.commit_count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Stats refresh automatically every 60 seconds. Commit data cached for up to 15 minutes.
      </p>
    </div>
  );
}
