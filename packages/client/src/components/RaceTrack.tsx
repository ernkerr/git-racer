interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
}

function Lane({
  label,
  carSrc,
  pct,
  commits,
  isWinner,
}: {
  label: string;
  carSrc: string;
  pct: number;
  commits: number;
  isWinner: boolean;
}) {
  return (
    <div>
      <div className="flex items-end h-5 sm:h-[60px]">
        <span
          className="font-pixel text-[7px] sm:text-[9px] w-6 sm:w-10 shrink-0 uppercase truncate"
          style={{ color: isWinner ? "var(--green)" : "var(--muted)" }}
        >
          {label}
        </span>
        <div className="flex-1 relative h-full">
          {/* Track line at the very bottom */}
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ height: "1px", background: "#555" }}
          />
          {/* Car sitting on the line */}
          <img
            src={carSrc}
            alt={`${label} car`}
            className="absolute z-10 transition-all duration-500 h-5 sm:h-[60px] w-auto bottom-0"
            style={{
              left: `${pct}%`,
              imageRendering: "pixelated",
            }}
          />
        </div>
      </div>
      {/* Commit count */}
      <div className="flex items-center">
        <span className="w-6 sm:w-10 shrink-0" />
        <div className="flex-1 relative h-3 sm:h-4">
          <span
            className="font-mono text-[8px] sm:text-[10px] absolute"
            style={{
              left: `${pct}%`,
              color: isWinner ? "var(--green)" : "var(--muted)",
              transform: "translateX(4px)",
            }}
          >
            {commits}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RaceTrack({ yourCommits, theirCommits, theirLabel = "them" }: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 65; // keep cars behind the right edge of the track
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;
  const youWin = yourCommits >= theirCommits;

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      {/* Track lanes */}
      <div className="flex-1 space-y-1 sm:space-y-2">
        <Lane
          label="you"
          carSrc={youWin ? "/car-green.png" : "/car-gray.png"}
          pct={youPct}
          commits={yourCommits}
          isWinner={youWin}
        />
        <Lane
          label={theirLabel}
          carSrc={!youWin ? "/car-green.png" : "/car-gray.png"}
          pct={themPct}
          commits={theirCommits}
          isWinner={!youWin}
        />
      </div>

      {/* Finish flag — separate column, never overlaps lines */}
      <div className="shrink-0 flex items-center">
        <img
          src="/finish-line.png"
          alt="finish"
          className="h-10 sm:h-28 w-auto"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  );
}
