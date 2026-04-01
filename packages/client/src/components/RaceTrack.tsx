interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
}

export default function RaceTrack({ yourCommits, theirCommits, theirLabel = "them" }: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 80; // max percentage for car position
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;

  return (
    <div className="relative pr-6">
      {/* Shared checkered flag */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        <span className="text-sm leading-none">🏁</span>
      </div>

      {/* You lane */}
      <div className="mb-4">
        <div className="flex items-center h-3">
          <span className="font-pixel text-[9px] text-arcade-gray w-8 shrink-0 uppercase">you</span>
          <div className="flex-1 relative h-full">
            {/* Track line */}
            <div
              className="absolute top-1/2 left-0 right-0 h-px"
              style={{ background: "var(--border)", transform: "translateY(-0.5px)" }}
            />
            {/* Car */}
            <div
              className="absolute top-0 h-3 w-5 transition-all duration-500"
              style={{ left: `${youPct}%`, background: "var(--green)" }}
            />
          </div>
        </div>
        {/* Commit count below car */}
        <div className="flex items-center">
          <span className="w-8 shrink-0" />
          <div className="flex-1 relative">
            <span
              className="font-mono text-[10px] absolute"
              style={{ left: `${youPct}%`, color: "var(--green)", transform: "translateX(2px)" }}
            >
              {yourCommits}
            </span>
          </div>
        </div>
      </div>

      {/* Them lane */}
      <div>
        <div className="flex items-center h-3">
          <span className="font-pixel text-[9px] text-arcade-gray w-8 shrink-0 uppercase truncate">
            {theirLabel}
          </span>
          <div className="flex-1 relative h-full">
            {/* Track line */}
            <div
              className="absolute top-1/2 left-0 right-0 h-px"
              style={{ background: "var(--border)", transform: "translateY(-0.5px)" }}
            />
            {/* Car */}
            <div
              className="absolute top-0 h-3 w-5 transition-all duration-500"
              style={{ left: `${themPct}%`, background: "var(--muted)" }}
            />
          </div>
        </div>
        {/* Commit count below car */}
        <div className="flex items-center">
          <span className="w-8 shrink-0" />
          <div className="flex-1 relative">
            <span
              className="font-mono text-[10px] absolute"
              style={{ left: `${themPct}%`, color: "var(--muted)", transform: "translateX(2px)" }}
            >
              {theirCommits}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
