import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import type {
  UserStats,
  ActiveChallenge,
  LeagueGroup,
  StarredUser,
  StarSuggestion,
  SocialCircleData,
  UserStreakInfo,
  ContributionGraphData,
} from "@git-racer/shared";
import ContributionGraph from "../components/ContributionGraph.tsx";
import LeagueCard from "../components/LeagueCard.tsx";
import StarredUsers from "../components/StarredUsers.tsx";
import StreakCard from "../components/StreakCard.tsx";
import SocialCircle from "../components/SocialCircle.tsx";
import ShareButton from "../components/ShareButton.tsx";
import GitHubUserSearch from "../components/GitHubUserSearch.tsx";

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="retro-box bg-arcade-surface p-4">
      <p className="font-pixel text-xs text-arcade-gray mb-2 uppercase">{label}</p>
      <p className="font-pixel text-2xl tabular-nums text-arcade-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function RaceStatus({ status }: { status: "winning" | "losing" | "tied" | "none" }) {
  return (
    <span className="race-status">
      <span className={`race-status-dot red ${status === "losing" ? "lit" : ""}`} />
      <span className={`race-status-dot yellow ${status === "tied" ? "lit" : ""}`} />
      <span className={`race-status-dot green ${status === "winning" ? "lit" : ""}`} />
    </span>
  );
}

function RaceCard({ ch }: { ch: ActiveChallenge }) {
  const raceStatus =
    ch.leader_username === "" ? "none" as const
    : ch.leader_commits > ch.your_commits ? "losing" as const
    : ch.leader_commits < ch.your_commits ? "winning" as const
    : "tied" as const;

  const isSprint = ch.duration_type === "fixed";
  const isFinished = ch.end_date && new Date(ch.end_date) < new Date();

  return (
    <Link
      to={`/c/${ch.share_slug}`}
      className="retro-box bg-arcade-surface p-4 block hover:-translate-y-px transition-all"
      style={
        raceStatus === "losing"
          ? { borderColor: "#DC2626" }
          : raceStatus === "winning"
          ? { borderColor: "#16A34A" }
          : raceStatus === "tied"
          ? { borderColor: "#EAB308" }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RaceStatus status={raceStatus} />
            <h3 className="font-pixel text-base text-arcade-white">{ch.name}</h3>
            <span
              className="font-pixel text-[10px] px-1.5 py-0.5 border-2"
              style={{
                borderColor: isSprint ? "#06B6D4" : "#FF006E",
                color: isSprint ? "#06B6D4" : "#FF006E",
              }}
            >
              {isFinished ? "DONE" : isSprint ? "SPRINT" : "RACE"}
            </span>
          </div>
          <p className="font-mono text-xs text-arcade-gray">
            {ch.participant_count} participant{ch.participant_count !== 1 ? "s" : ""}
            {ch.end_date &&
              ` · ends ${new Date(ch.end_date).toLocaleDateString()}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-pixel text-3xl tabular-nums text-arcade-white">
            {ch.your_commits}
          </p>
          <p className="font-pixel text-xs" style={{
            color: raceStatus === "none" ? "#78716C"
              : raceStatus === "losing" ? "#DC2626"
              : raceStatus === "winning" ? "#16A34A"
              : "#EAB308"
          }}>
            {raceStatus === "none" ? "" : raceStatus === "losing"
              ? `${ch.leader_commits - ch.your_commits} BEHIND`
              : raceStatus === "winning" ? "YOU LEAD"
              : "TIED"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function RaceSearchBar() {
  const navigate = useNavigate();
  const [opponent, setOpponent] = useState("");
  const [starting, setStarting] = useState(false);

  const startRace = async (username: string) => {
    if (!username.trim() || starting) return;
    setStarting(true);
    try {
      const result = await api<{ share_slug: string }>("/challenges", {
        method: "POST",
        body: JSON.stringify({
          name: `vs ${username}`,
          type: "1v1",
          duration_type: "ongoing",
          opponents: [username],
        }),
      });
      navigate(`/c/${result.share_slug}`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="retro-box bg-arcade-surface p-4">
      <p className="font-pixel text-xs text-arcade-cyan mb-3">RACE SOMEONE</p>
      <div className="flex gap-3">
        <div className="flex-1">
          <GitHubUserSearch
            value={opponent}
            onChange={setOpponent}
            placeholder="Search any GitHub user..."
          />
        </div>
        <button
          onClick={() => startRace(opponent)}
          disabled={!opponent.trim() || starting}
          className="btn-arcade bg-arcade-pink text-black font-pixel text-xs px-4 py-2 shrink-0 disabled:opacity-40"
        >
          {starting ? "..." : "GO"}
        </button>
      </div>
      <p className="font-mono text-xs text-arcade-gray mt-2">
        Commits are loaded from their real GitHub history — not starting from 0.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [league, setLeague] = useState<LeagueGroup | null>(null);
  const [starred, setStarred] = useState<StarredUser[]>([]);
  const [suggestions, setSuggestions] = useState<StarSuggestion[]>([]);
  const [socialData, setSocialData] = useState<SocialCircleData>({ entries: [], your_rank: 0, total: 0 });
  const [streaks, setStreaks] = useState<UserStreakInfo | null>(null);
  const [contributions, setContributions] = useState<ContributionGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(true);

  const loadStarred = useCallback(() => {
    api<StarredUser[]>("/starred?period=week").then(setStarred).catch(() => {});
    api<StarSuggestion[]>("/starred/suggestions").then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    api<{
      stats: UserStats;
      challenges: ActiveChallenge[];
      streaks: UserStreakInfo;
      contributions: ContributionGraphData;
    }>("/me/dashboard")
      .then((data) => {
        setStats(data.stats);
        setChallenges(data.challenges);
        setStreaks(data.streaks);
        setContributions(data.contributions);
      })
      .catch((err) => console.error("Dashboard load failed:", err))
      .finally(() => setLoading(false));

    api<LeagueGroup>("/leagues/current").then(setLeague).catch(() => {});
    api<StarredUser[]>("/starred?period=week").then(setStarred).catch(() => []);
    api<StarSuggestion[]>("/starred/suggestions").then(setSuggestions).catch(() => []);
    api<SocialCircleData>("/social/circle")
      .then(setSocialData)
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, []);

  if (loading) {
    return <div className="font-pixel text-sm text-arcade-gray">LOADING YOUR STATS...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="checker-bar" />

      {/* Header + Share */}
      <div className="flex items-center justify-between">
        <h1 className="font-pixel text-2xl text-arcade-white">
          DASHBOARD
        </h1>
        <ShareButton />
      </div>

      {/* Race Someone — primary action */}
      <RaceSearchBar />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatsCard label="Today" value={stats.today} />
          <StatsCard label="This Week" value={stats.this_week} />
          <StatsCard label="This Month" value={stats.this_month} />
          <StatsCard label="This Year" value={stats.this_year} />
          <StatsCard label="All Time" value={stats.all_time} />
        </div>
      )}

      {/* Streaks & Records */}
      {streaks && <StreakCard streaks={streaks} />}

      <div className="checker-strip" />

      {/* Active Races */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-base text-arcade-cyan">YOUR RACES</h2>
          <Link
            to="/challenges/new"
            className="btn-arcade bg-arcade-pink text-black font-pixel text-xs px-3 py-2"
          >
            NEW RACE
          </Link>
        </div>

        {challenges.length === 0 ? (
          <div className="retro-box bg-arcade-surface p-8 text-center">
            <p className="font-pixel text-sm text-arcade-gray mb-4">NO ACTIVE RACES YET.</p>
            <p className="font-mono text-xs text-arcade-gray">
              Use the search bar above to race any GitHub user.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((ch) => <RaceCard key={ch.id} ch={ch} />)}
          </div>
        )}
      </div>

      <div className="checker-strip" />

      {/* Social Circle */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">YOUR CIRCLE</h2>
        <SocialCircle data={socialData} loading={socialLoading} />
      </div>

      {/* Starred Users */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">STARRED DEVS</h2>
        <StarredUsers
          starred={starred}
          suggestions={suggestions}
          onStar={loadStarred}
          onUnstar={(username) => {
            setStarred((prev) => prev.filter((s) => s.github_username !== username));
            loadStarred();
          }}
        />
      </div>

      <div className="checker-divider" />

      {/* Weekly League */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">WEEKLY LEAGUE</h2>
        {league ? (
          <LeagueCard league={league} />
        ) : (
          <div className="retro-box bg-arcade-surface p-6 text-center">
            <p className="font-pixel text-sm text-arcade-gray">YOUR LEAGUE IS BEING SET UP. CHECK BACK SOON!</p>
          </div>
        )}
      </div>

      {/* Contribution Graph */}
      {contributions && (
        <div className="retro-box bg-arcade-surface p-5">
          <ContributionGraph days={contributions.days} totalYear={contributions.total_year} />
        </div>
      )}

      <div className="checker-strip" />
    </div>
  );
}
