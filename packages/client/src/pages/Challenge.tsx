import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { CHALLENGE_REFRESH_MS } from "@git-racer/shared";
import type { ChallengeWithLeaderboard, LeaderboardEntry, RefreshPeriod } from "@git-racer/shared";
import RacePath from "../components/RacePath.tsx";
import RaceTrack from "../components/RaceTrack.tsx";
import ShareModal from "../components/ShareModal.tsx";

function RaceTypeBadge({ durationType }: { durationType: string }) {
  const isSprint = durationType === "fixed";
  return (
    <span
      className="font-pixel text-[11px] px-2 py-1 border-3"
      style={{
        borderColor: isSprint ? "#00E676" : "#00C853",
        color: isSprint ? "#00E676" : "#00C853",
        backgroundColor: "var(--arcade-surface)",
      }}
    >
      {isSprint ? "SPRINT" : durationType === "ongoing" ? "RACE" : "GOAL"}
    </span>
  );
}

function HeadToHead({
  you,
  them,
  isFinished,
}: {
  you: LeaderboardEntry | null;
  them: LeaderboardEntry | null;
  isFinished: boolean;
}) {
  if (!you || !them) return null;

  const youWin = you.commit_count > them.commit_count;
  const tied = you.commit_count === them.commit_count;
  const gap = Math.abs(you.commit_count - them.commit_count);

  return (
    <div className="retro-box bg-arcade-surface p-5 mb-6">
      {/* Labels */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-center">
          <img
            src={you.avatar_url || `https://github.com/${you.github_username}.png`}
            alt={you.github_username}
            className="w-12 h-12 rounded-none border-3 border-arcade-border mx-auto mb-2"
          />
          <p className="font-pixel text-xs text-arcade-gray">{you.github_username}</p>
          <p
            className="font-pixel text-4xl tabular-nums mt-1"
            style={{ color: youWin ? "#00C853" : tied ? "#EAB308" : "var(--text)" }}
          >
            {you.commit_count.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <img
            src={them.avatar_url || `https://github.com/${them.github_username}.png`}
            alt={them.github_username}
            className="w-12 h-12 rounded-none border-3 border-arcade-border mx-auto mb-2"
          />
          <p className="font-pixel text-xs text-arcade-gray">{them.github_username}</p>
          <p
            className="font-pixel text-4xl tabular-nums mt-1"
            style={{ color: !youWin && !tied ? "#00C853" : tied ? "#EAB308" : "var(--text)" }}
          >
            {them.commit_count.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Race track visualization */}
      <RaceTrack
        yourCommits={you.commit_count}
        theirCommits={them.commit_count}
        theirLabel={them.github_username.slice(0, 5)}
      />

      {/* Status line */}
      <p className="font-pixel text-sm text-center" style={{
        color: youWin ? "#00C853" : tied ? "#EAB308" : "#00E676"
      }}>
        {tied
          ? "TIED"
          : youWin
          ? isFinished
            ? `YOU WIN! +${gap} COMMITS`
            : `YOU LEAD BY ${gap}`
          : isFinished
          ? `YOU LOSE. ${gap} BEHIND`
          : `${gap} COMMITS BEHIND`}
      </p>
    </div>
  );
}

export default function Challenge() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeWithLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsEndDate, setSettingsEndDate] = useState("");
  const [settingsRefreshPeriod, setSettingsRefreshPeriod] = useState<RefreshPeriod>("weekly");
  const [saving, setSaving] = useState(false);

  const fetchChallenge = async () => {
    try {
      const data = await api<ChallengeWithLeaderboard>(`/challenges/${slug}`);
      setChallenge(data);
      if (data.end_date) {
        setSettingsEndDate(new Date(data.end_date).toISOString().slice(0, 10));
      }
      setSettingsRefreshPeriod(data.refresh_period ?? "ongoing");
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
      body.refresh_period = settingsRefreshPeriod;
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

  if (loading) return <div className="font-pixel text-sm text-arcade-gray">LOADING RACE...</div>;
  if (!challenge) return <div className="font-pixel text-sm text-arcade-gray">RACE NOT FOUND.</div>;

  const isCreator = user && challenge.created_by === user.id;
  const isParticipant = user && challenge.participants.some(
    (p) => p.github_username === user.github_username
  );
  const isFinished = challenge.end_date ? new Date(challenge.end_date) < new Date() : false;
  const isGoal = challenge.duration_type === "goal";
  const goalReached = isGoal && challenge.goal_target &&
    challenge.participants.some((p) => p.commit_count >= challenge.goal_target!);
  const canJoin = user && !isParticipant && !isFinished && !goalReached && challenge.type === "team";

  // For 1v1: find "you" and "them"
  const you1v1 = user
    ? challenge.participants.find((p) => p.github_username === user.github_username) ?? null
    : null;
  const them1v1 = challenge.type === "1v1"
    ? challenge.participants.find((p) => p.github_username !== user?.github_username) ?? null
    : null;
  const show1v1 = challenge.type === "1v1" && you1v1 && them1v1;

  const pageLabel = challenge.duration_type === "fixed" ? "SPRINT" : "RACE";

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
            <RaceTypeBadge durationType={challenge.duration_type} />
            {challenge.type === "team" && (
              <span className="font-pixel text-[11px] px-2 py-1 bg-arcade-surface border-3 border-arcade-border text-arcade-gray">
                TEAM
              </span>
            )}
            {(isFinished || goalReached) && (
              <span className="font-pixel text-[11px] px-2 py-1 text-arcade-pink border-3"
                style={{ borderColor: "#00C853" }}>
                FINISHED
              </span>
            )}
          </div>
          <h1 className="font-pixel text-2xl text-arcade-white mb-1">
            {challenge.name}
          </h1>
          <p className="font-mono text-xs text-arcade-gray">
            {challenge.end_date
              ? `Ends ${new Date(challenge.end_date).toLocaleDateString()}`
              : isGoal
              ? `First to ${challenge.goal_target} ${challenge.goal_metric}`
              : `Since ${new Date(challenge.start_date).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
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
            onClick={() => setShowShare(true)}
            className="btn-arcade bg-arcade-surface text-arcade-white font-pixel text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            SHARE
          </button>
        </div>
      </div>

      {/* 1v1 Head-to-Head display */}
      {show1v1 && (
        <HeadToHead you={you1v1} them={them1v1} isFinished={isFinished} />
      )}

      {/* Race Path — daily velocity chart for 1v1 */}
      {show1v1 && challenge.daily && (
        <RacePath
          you={challenge.daily[you1v1!.github_username] ?? []}
          rival={
            them1v1
              ? { username: them1v1.github_username, data: challenge.daily[them1v1.github_username] ?? [] }
              : null
          }
          label={
            challenge.end_date
              ? `${new Date(challenge.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(challenge.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "RACE DURATION"
          }
        />
      )}

      {/* Race Stats */}
      {challenge.race_stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="retro-box bg-arcade-surface p-4">
            <p className="font-pixel text-xs text-arcade-gray mb-1">TOTAL COMMITS</p>
            <p className="font-pixel text-xl tabular-nums text-arcade-white">
              {challenge.race_stats.total_commits.toLocaleString()}
            </p>
          </div>
          <div className="retro-box bg-arcade-surface p-4">
            <p className="font-pixel text-xs text-arcade-gray mb-1">REPOS</p>
            <p className="font-pixel text-xl tabular-nums text-arcade-white">
              {challenge.race_stats.total_unique_repos.toLocaleString()}
            </p>
          </div>
          <div className="retro-box bg-arcade-surface p-4">
            <p className="font-pixel text-xs text-arcade-gray mb-1">PUSHES</p>
            <p className="font-pixel text-xl tabular-nums text-arcade-white">
              {challenge.race_stats.total_pushes.toLocaleString()}
            </p>
          </div>
          <div className="retro-box bg-arcade-surface p-4">
            <p className="font-pixel text-xs text-arcade-gray mb-1">RACERS</p>
            <p className="font-pixel text-xl tabular-nums text-arcade-white">
              {challenge.race_stats.participant_count}
            </p>
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
                <div className="h-4 bg-arcade-bg border-3 border-arcade-border overflow-hidden">
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
        <div className="retro-box bg-arcade-pink/10 p-4 mb-6 text-center" style={{ borderColor: "#00C853" }}>
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

      {/* Participants table — for team races or when not logged in */}
      {(challenge.type === "team" || !user) && (
        <div className="retro-box bg-arcade-surface overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 bg-arcade-bg border-b-4 border-arcade-border">
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
                  className="w-8 h-8 rounded-none border-3 border-arcade-border"
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
      )}

      {/* For 1v1 with no user session, show a plain list */}
      {challenge.type === "1v1" && !user && (
        <div className="retro-box bg-arcade-surface overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 bg-arcade-bg border-b-4 border-arcade-border">
            <span className="font-pixel text-xs text-arcade-cyan">#</span>
            <span className="font-pixel text-xs text-arcade-cyan">RACER</span>
            <span className="font-pixel text-xs text-arcade-cyan">COMMITS</span>
          </div>
          {challenge.participants.map((p, i) => (
            <div
              key={p.github_username}
              className={`grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-3 items-center ${i === 0 ? "bg-arcade-pink/10" : ""}`}
            >
              <span className="font-pixel text-xs text-arcade-gray w-6 text-center">{i + 1}</span>
              <div className="flex items-center gap-3">
                <img
                  src={p.avatar_url || `https://github.com/${p.github_username}.png`}
                  alt={p.github_username}
                  className="w-8 h-8 rounded-none border-3 border-arcade-border"
                />
                <span className="font-mono text-sm text-arcade-white">{p.github_username}</span>
              </div>
              <span className="font-pixel text-xl tabular-nums text-arcade-white">
                {p.commit_count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="font-mono text-xs text-arcade-gray mt-4 text-center space-y-1">
        {challenge.refresh_period === "daily" && <p>Counts reset daily at midnight UTC.</p>}
        {challenge.refresh_period === "weekly" && <p>Counts reset every Monday at midnight UTC.</p>}
        <p>Stats refresh automatically every 60 seconds.</p>
        <p>Commit data cached for up to 4 hours.</p>
      </div>

      {/* Creator controls at bottom */}
      {isCreator && (
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-arcade bg-arcade-surface text-arcade-white font-pixel text-xs px-4 py-2"
            >
              {showSettings ? "HIDE SETTINGS" : "SETTINGS"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-arcade font-pixel text-xs px-4 py-2"
              style={{ borderColor: "#DC2626", backgroundColor: "var(--arcade-zone-demote)", color: "#DC2626" }}
            >
              {deleting ? "..." : "DELETE RACE"}
            </button>
          </div>

          {showSettings && (
            <div className="retro-box bg-arcade-surface p-4 space-y-4">
              <h3 className="font-pixel text-xs text-arcade-cyan">RACE SETTINGS</h3>

              <div>
                <label className="block font-pixel text-xs text-arcade-gray mb-2">COUNTING PERIOD</label>
                <div className="flex gap-2">
                  {([
                    { value: "daily", label: "DAILY" },
                    { value: "weekly", label: "WEEKLY" },
                    { value: "ongoing", label: "ALL TIME" },
                  ] as const).map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setSettingsRefreshPeriod(p.value)}
                      className={`btn-arcade flex-1 py-2 font-pixel text-xs ${
                        settingsRefreshPeriod === p.value
                          ? "bg-arcade-cyan text-black"
                          : "bg-arcade-surface text-arcade-gray"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

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
        </div>
      )}

      {/* Share drawer/modal */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        shareText={
          challenge.participants[0]
            ? `${challenge.participants[0].github_username} leads "${challenge.name}" with ${challenge.participants[0].commit_count} commits. Can you beat them?`
            : `Join my commit race "${challenge.name}" on Git Racer!`
        }
        shareUrl={window.location.href}
      />
    </div>
  );
}
