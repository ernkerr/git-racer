interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
}

export default function RaceTrack({ yourCommits, theirCommits, theirLabel = "them" }: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 75;
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;
  const youWin = yourCommits >= theirCommits;

  return (
    <div className="relative pr-16">
      {/* Shared finish line – centered between both lanes */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center z-10">
        <img
          src="/finish-line.png"
          alt="finish"
          className="h-24 w-auto"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* You lane */}
      <div className="mb-2">
        <div className="flex items-center" style={{ height: "48px" }}>
          <span className="font-pixel text-[9px] text-arcade-gray w-10 shrink-0 uppercase">you</span>
          <div className="flex-1 relative h-full">
            {/* Solid gray track line */}
            <div
              className="absolute left-0 right-0"
              style={{ bottom: "4px", height: "3px", background: "#444" }}
            />
            {/* Car – bottom-aligned, on top of line */}
            <img
              src={youWin ? "/car-green.png" : "/car-gray.png"}
              alt="your car"
              className="absolute z-10 transition-all duration-500"
              style={{
                left: `${youPct}%`,
                bottom: 0,
                height: "40px",
                width: "auto",
                imageRendering: "pixelated",
              }}
            />
          </div>
        </div>
        {/* Commit count */}
        <div className="flex items-center">
          <span className="w-10 shrink-0" />
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
        <div className="flex items-center" style={{ height: "48px" }}>
          <span className="font-pixel text-[9px] text-arcade-gray w-10 shrink-0 uppercase truncate">
            {theirLabel}
          </span>
          <div className="flex-1 relative h-full">
            {/* Solid gray track line */}
            <div
              className="absolute left-0 right-0"
              style={{ bottom: "4px", height: "3px", background: "#444" }}
            />
            {/* Car */}
            <img
              src={!youWin ? "/car-green.png" : "/car-gray.png"}
              alt="their car"
              className="absolute z-10 transition-all duration-500"
              style={{
                left: `${themPct}%`,
                bottom: 0,
                height: "40px",
                width: "auto",
                imageRendering: "pixelated",
              }}
            />
          </div>
        </div>
        {/* Commit count */}
        <div className="flex items-center">
          <span className="w-10 shrink-0" />
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
