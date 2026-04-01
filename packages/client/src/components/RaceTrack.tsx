interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
}

export default function RaceTrack({ yourCommits, theirCommits, theirLabel = "them" }: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 75; // max percentage for car position
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;

  const youWin = yourCommits >= theirCommits;

  return (
    <div className="relative pr-8">
      {/* Shared finish line */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center">
        <img src="/finish-line.png" alt="finish" className="h-10 w-auto" style={{ imageRendering: "pixelated" }} />
      </div>

      {/* You lane */}
      <div className="mb-1">
        <div className="flex items-center h-5">
          <span className="font-pixel text-[9px] text-arcade-gray w-8 shrink-0 uppercase">you</span>
          <div className="flex-1 relative h-full">
            {/* Track line */}
            <div
              className="absolute top-1/2 left-0 right-0 h-px"
              style={{ background: "var(--border)", transform: "translateY(-0.5px)" }}
            />
            {/* Car */}
            <img
              src={youWin ? "/car-green.png" : "/car-gray.png"}
              alt="your car"
              className="absolute top-0 h-5 w-auto transition-all duration-500"
              style={{ left: `${youPct}%`, imageRendering: "pixelated" }}
            />
          </div>
        </div>
        {/* Commit count below car */}
        <div className="flex items-center">
          <span className="w-8 shrink-0" />
          <div className="flex-1 relative h-4">
            <span
              className="font-mono text-[10px] absolute"
              style={{ left: `${youPct}%`, color: youWin ? "var(--green)" : "var(--muted)", transform: "translateX(4px)" }}
            >
              {yourCommits}
            </span>
          </div>
        </div>
      </div>

      {/* Them lane */}
      <div>
        <div className="flex items-center h-5">
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
            <img
              src={!youWin ? "/car-green.png" : "/car-gray.png"}
              alt="their car"
              className="absolute top-0 h-5 w-auto transition-all duration-500"
              style={{ left: `${themPct}%`, imageRendering: "pixelated" }}
            />
          </div>
        </div>
        {/* Commit count below car */}
        <div className="flex items-center">
          <span className="w-8 shrink-0" />
          <div className="flex-1 relative h-4">
            <span
              className="font-mono text-[10px] absolute"
              style={{ left: `${themPct}%`, color: !youWin ? "var(--green)" : "var(--muted)", transform: "translateX(4px)" }}
            >
              {theirCommits}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
