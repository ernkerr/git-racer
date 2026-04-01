interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
}

const CAR_H = 40; // px
const WHEEL_OFFSET = 4; // px from bottom of car image to wheel center

export default function RaceTrack({ yourCommits, theirCommits, theirLabel = "them" }: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 75;
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;
  const youWin = yourCommits >= theirCommits;

  // Line sits at wheel level: WHEEL_OFFSET px from the bottom of the lane
  const lineBottom = `${WHEEL_OFFSET}px`;
  // Car bottom aligned so wheels rest on the line
  const carBottom = 0;

  return (
    <div className="relative pr-16">
      {/* Shared finish line – right side, centered between both lanes */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center z-20">
        <img
          src="/finish-line.png"
          alt="finish"
          className="h-24 w-auto"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* You lane */}
      <div className="mb-2">
        <div className="flex items-end" style={{ height: `${CAR_H + 4}px` }}>
          <span className="font-pixel text-[9px] text-arcade-gray w-10 shrink-0 uppercase" style={{ paddingBottom: `${WHEEL_OFFSET}px` }}>
            you
          </span>
          <div className="flex-1 relative h-full">
            {/* Track line – stops before the flag area */}
            <div
              className="absolute left-0"
              style={{ bottom: lineBottom, height: "1px", background: "#555", right: "0" }}
            />
            {/* Car on top of line */}
            <img
              src={youWin ? "/car-green.png" : "/car-gray.png"}
              alt="your car"
              className="absolute z-10 transition-all duration-500"
              style={{
                left: `${youPct}%`,
                bottom: carBottom,
                height: `${CAR_H}px`,
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
        <div className="flex items-end" style={{ height: `${CAR_H + 4}px` }}>
          <span className="font-pixel text-[9px] text-arcade-gray w-10 shrink-0 uppercase truncate" style={{ paddingBottom: `${WHEEL_OFFSET}px` }}>
            {theirLabel}
          </span>
          <div className="flex-1 relative h-full">
            {/* Track line */}
            <div
              className="absolute left-0"
              style={{ bottom: lineBottom, height: "1px", background: "#555", right: "0" }}
            />
            {/* Car */}
            <img
              src={!youWin ? "/car-green.png" : "/car-gray.png"}
              alt="their car"
              className="absolute z-10 transition-all duration-500"
              style={{
                left: `${themPct}%`,
                bottom: carBottom,
                height: `${CAR_H}px`,
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
