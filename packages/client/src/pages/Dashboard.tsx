import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
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
import RacePath from "../components/RacePath.tsx";
import ContributionGraph from "../components/ContributionGraph.tsx";
import LeagueCard from "../components/LeagueCard.tsx";
import StarredUsers from "../components/StarredUsers.tsx";
import StreakCard from "../components/StreakCard.tsx";
import SocialCircle from "../components/SocialCircle.tsx";
import ShareButton from "../components/ShareButton.tsx";

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

function RaceCard({ ch }: { ch: ActiveChallenge }) {
  const navigate = useNavigate();
  const diff = ch.your_commits - ch.leader_commits;
  const raceStatus =
    ch.leader_username === "" ? "none" as const
    : diff > 0 ? "winning" as const
    : diff < 0 ? "losing" as const
    : "tied" as const;

  const isSprint = ch.duration_type === "fixed";
  const isFinished = ch.end_date && new Date(ch.end_date) < new Date();

  const statusColor =
    raceStatus === "winning" ? "var(--green)"
    : raceStatus === "tied" ? "var(--yellow)"
    : raceStatus === "losing" ? "var(--muted)"
    : "var(--border)";

  const typeLabel = isFinished ? "DONE" : isSprint ? "SPRINT" : "RACE";

  return (
    <div
      onClick={() => navigate(`/c/${ch.share_slug}`)}
      className="retro-box bg-arcade-surface p-4 flex flex-col justify-between hover:bg-arcade-hover transition-colors cursor-pointer"
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
          <span className="font-mono text-[10px] text-arcade-gray uppercase">{typeLabel}</span>
        </div>
        <h3 className="font-pixel text-sm text-arcade-white leading-tight line-clamp-2">{ch.name}</h3>
        <p className="font-mono text-[11px] text-arcade-gray mt-1">
          {ch.participant_count} racer{ch.participant_count !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="mt-3">
        <p className="font-pixel text-xl tabular-nums text-arcade-white">
          {ch.your_commits}
        </p>
        {raceStatus !== "none" && (
          <p className="font-mono text-[11px] mt-0.5" style={{ color: statusColor }}>
            {raceStatus === "losing"
              ? `${Math.abs(diff)} behind`
              : raceStatus === "winning" ? `+${diff} ahead`
              : "Tied"}
          </p>
        )}
      </div>
    </div>
  );
}


function BadgeEmbed({ username, siteUrl }: { username: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);

  const badgeUrl = `${siteUrl}/api/badge/${username}`;
  const markdown = `<a href="${siteUrl}"><img src="${badgeUrl}" alt="Git Racer Stats" width="100%"></a>`;

  const copy = () => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="retro-box bg-arcade-surface p-4">
      <div className="mb-3">
        <h3 className="font-pixel text-xs text-arcade-gray uppercase">Add to GitHub Profile</h3>
      </div>

      <div className="mb-3 flex justify-center">
        <div className="bg-[#0C0C0C] border border-[#2A2A2A] rounded-md p-2 inline-block max-w-full">
          <img
            src={`/api/badge/${username}`}
            alt="Git Racer Stats Badge"
            className="max-w-full"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          readOnly
          value={markdown}
          className="flex-1 bg-arcade-bg text-arcade-gray font-mono text-[11px] px-3 py-1.5 rounded border border-arcade-border outline-none focus:border-arcade-green"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={copy}
          className="btn-arcade font-pixel text-[10px] px-3 py-1.5 whitespace-nowrap"
        >
          {copied ? "COPIED!" : "COPY"}
        </button>
      </div>
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
  const { user } = useAuth();

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

      {/* Stats row — your numbers first */}
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

      {/* YOUR RACES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-base text-arcade-white">YOUR RACES</h2>
          <Link
            to="/challenges/new"
            className="btn-arcade font-pixel text-xs px-3 py-1.5"
          >
            + NEW RACE
          </Link>
        </div>

        {challenges.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {challenges.map((ch) => <RaceCard key={ch.id} ch={ch} />)}
          </div>
        )}

        <StarredUsers
          starred={starred}
          suggestions={suggestions}
          onStar={loadStarred}
          onUnstar={(username) => {
            setStarred((prev) => prev.filter((s) => s.github_username !== username));
            loadStarred();
          }}
          showEmpty={challenges.length === 0}
        />
      </div>

      <div className="checker-strip" />

      {/* Social Circle */}
      <div>
        <h2 className="font-pixel text-base text-arcade-cyan mb-3">YOUR CIRCLE</h2>
        <SocialCircle data={socialData} loading={socialLoading} />
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

      {/* GitHub Profile Badge */}
      {user && (
        <div>
          <h2 className="font-pixel text-base text-arcade-cyan mb-3">GITHUB BADGE</h2>
          <BadgeEmbed username={user.github_username} siteUrl={user.site_url} />
        </div>
      )}

      <div className="checker-strip" />

      {/* Contribution graph + Race Path — at the bottom */}
      {contributions && contributions.days.length > 0 && (
        <div className="retro-box bg-arcade-surface p-4">
          <ContributionGraph days={contributions.days} totalYear={contributions.total_year} />
        </div>
      )}

      {contributions && (
        <RacePath
          you={contributions.days.slice(-30)}
          label="LAST 30 DAYS"
        />
      )}

      <div className="checker-strip" />
    </div>
  );
}
