import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { CHALLENGE_REFRESH_MS } from "@git-racer/shared";
import type { ChallengeWithLeaderboard } from "@git-racer/shared";

export default function Challenge() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeWithLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsEndDate, setSettingsEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchChallenge = async () => {
    try {
      const data = await api<ChallengeWithLeaderboard>(`/challenges/${slug}`);
      setChallenge(data);
      if (data.end_date) {
        setSettingsEndDate(new Date(data.end_date).toISOString().slice(0, 10));
      }
    } catch {
      // Challenge not found or API error
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

  const handleDelete = async () => {
    if (!confirm("Delete this race? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api(`/challenges/${slug}`, { method: "DELETE" });
      navigate("/dashboard");
    } catch {
      setDeleting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (settingsEndDate) {
        body.end_date = new Date(settingsEndDate).toISOString();
      }
      await api(`/challenges/${slug}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await fetchChallenge();
      setShowSettings(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToX = () => {
    const leader = challenge!.participants[0];
    const text = leader
      ? `${leader.github_username} leads "${challenge!.name}" with ${leader.commit_count} commits. Can you beat them?`
      : `Join my commit race "${challenge!.name}" on Git Racer!`;
    const url = window.location.href;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );
  };

  if (loading) return <div className="font-pixel text-sm text-arcade-gray">LOADING RACE...</div>;
  if (!challenge) return <div className="font-pixel text-sm text-arcade-gray">RACE NOT FOUND.</div>;

  const isCreator = user && challenge.created_by === user.id;
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
      {/* Back button */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 font-pixel text-xs text-arcade-gray hover:text-arcade-cyan mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        BACK
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h1 className="font-pixel text-2xl text-arcade-white">
              {challenge.name}
            </h1>
            <span className="font-pixel text-[11px] px-2 py-1 bg-arcade-surface border-3 border-black text-arcade-gray">
              {challenge.type.toUpperCase()}
            </span>
          </div>
          <p className="font-mono text-xs text-arcade-gray">
            {new Date(challenge.start_date).toLocaleDateString()} —{" "}
            {challenge.end_date
              ? new Date(challenge.end_date).toLocaleDateString()
              : isGoal
              ? `FIRST TO ${challenge.goal_target} ${challenge.goal_metric}`
              : "ONGOING"}
            {(isFinished || goalReached) && (
              <span className="font-pixel text-xs text-arcade-pink ml-2">FINISHED</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {canJoin && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn-arcade bg-arcade-cyan text-white font-pixel text-xs px-4 py-2"
            >
              {joining ? "..." : "JOIN"}
            </button>
          )}
          <button
            onClick={copyLink}
            className="btn-arcade bg-arcade-surface text-arcade-white font-pixel text-xs px-4 py-2"
          >
            {copied ? "COPIED!" : "COPY LINK"}
          </button>
          <button
            onClick={shareToX}
            className="btn-arcade bg-arcade-surface text-arcade-white font-pixel text-xs px-4 py-2"
          >
            SHARE TO X
          </button>
          {isCreator && (
            <>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="btn-arcade bg-arcade-surface text-arcade-white font-pixel text-xs px-4 py-2"
              >
                SETTINGS
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-arcade bg-red-50 text-red-600 font-pixel text-xs px-4 py-2"
                style={{ borderColor: "#DC2626" }}
              >
                {deleting ? "..." : "DELETE"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && isCreator && (
        <div className="retro-box bg-arcade-surface p-4 mb-6 space-y-4">
          <h3 className="font-pixel text-xs text-arcade-cyan">RACE SETTINGS</h3>

          <div>
            <label className="block font-pixel text-xs text-arcade-gray mb-2">END DATE (OPTIONAL)</label>
            <input
              type="date"
              value={settingsEndDate}
              onChange={(e) => setSettingsEndDate(e.target.value)}
              className="input-arcade w-full px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-arcade bg-arcade-cyan text-white font-pixel text-xs px-4 py-2"
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="btn-arcade bg-arcade-surface text-arcade-gray font-pixel text-xs px-4 py-2"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Goal progress bar */}
      {isGoal && challenge.goal_target && challenge.participants.length > 0 && (
        <div className="retro-box bg-arcade-surface p-4 mb-6">
          <p className="font-pixel text-xs text-arcade-gray mb-3">
            GOAL: {challenge.goal_target} {challenge.goal_metric}
          </p>
          {challenge.participants.slice(0, 3).map((p) => {
            const pct = Math.min(100, (p.commit_count / challenge.goal_target!) * 100);
            return (
              <div key={p.github_username} className="mb-3 last:mb-0">
                <div className="flex justify-between font-mono text-xs text-arcade-gray mb-1">
                  <span>{p.github_username}</span>
                  <span>{p.commit_count} / {challenge.goal_target}</span>
                </div>
                <div className="h-4 bg-arcade-bg border-3 border-black overflow-hidden">
                  <div
                    className="h-full bg-arcade-pink transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Join CTA for visitors */}
      {!isParticipant && challenge.type === "team" && !isFinished && !goalReached && (
        <div className="retro-box bg-arcade-pink/10 p-4 mb-6 text-center" style={{ borderColor: "#FF006E" }}>
          {user ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn-arcade bg-arcade-pink text-black font-pixel text-base px-8 py-3"
            >
              {joining ? "JOINING..." : "JOIN THIS RACE"}
            </button>
          ) : (
            <>
              <p className="font-pixel text-sm text-arcade-white mb-3">WANT TO JOIN THIS RACE?</p>
              <a
                href={`/api/auth/github?redirect=${encodeURIComponent(window.location.pathname)}`}
                className="btn-arcade bg-arcade-pink text-black font-pixel text-sm px-6 py-3 inline-flex"
              >
                SIGN IN TO JOIN
              </a>
            </>
          )}
        </div>
      )}

      {/* Participants table */}
      <div className="retro-box bg-arcade-surface overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 bg-arcade-bg border-b-4 border-black">
          <span className="font-pixel text-xs text-arcade-cyan">#</span>
          <span className="font-pixel text-xs text-arcade-cyan">RACER</span>
          <span className="font-pixel text-xs text-arcade-cyan">COMMITS</span>
        </div>
        {challenge.participants.map((p, i) => (
          <div
            key={p.github_username}
            className={`grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 items-center ${
              i === 0 ? "bg-arcade-pink/10" : ""
            } ${
              user?.github_username === p.github_username
                ? "border-l-4 border-arcade-pink"
                : ""
            }`}
          >
            <span className="font-pixel text-xs text-arcade-gray w-6 text-center">
              {i + 1}
            </span>
            <div className="flex items-center gap-3">
              <img
                src={p.avatar_url || `https://github.com/${p.github_username}.png`}
                alt={p.github_username}
                className="w-8 h-8 rounded-none border-3 border-black"
              />
              <span className="font-mono text-sm text-arcade-white">
                {p.github_username}
                {p.is_ghost && (
                  <span className="font-pixel text-[11px] text-arcade-gray ml-1">(public)</span>
                )}
              </span>
            </div>
            <span className="font-pixel text-xl tabular-nums text-arcade-white">
              {p.commit_count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <p className="font-mono text-xs text-arcade-gray mt-4 text-center">
        Stats refresh automatically every 60 seconds. Commit data cached for up to 4 hours.
      </p>
    </div>
  );
}
