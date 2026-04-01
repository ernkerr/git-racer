interface RaceTrackProps {
  yourCommits: number;
  theirCommits: number;
  theirLabel?: string;
  trackStyle?: "asphalt" | "retro";
}

const LANE_H = 44; // px – tall enough for h-10 car + padding

const laneStyles = {
  asphalt: {
    bg: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.25)",
    centerLine: "3px dashed rgba(255,255,255,0.35)",
  },
  retro: {
    bg: "#0a1a0a",
    border: "2px solid #00C853",
    centerLine: "2px dashed rgba(0,200,83,0.35)",
  },
};

function Lane({
  label,
  carSrc,
  pct,
  commits,
  isWinner,
  style,
}: {
  label: string;
  carSrc: string;
  pct: number;
  commits: number;
  isWinner: boolean;
  style: (typeof laneStyles)["asphalt"];
}) {
  return (
    <div>
      <div className="flex items-end" style={{ height: `${LANE_H}px` }}>
        <span className="font-pixel text-[9px] text-arcade-gray w-10 shrink-0 uppercase truncate pb-1">
          {label}
        </span>
        <div
          className="flex-1 relative h-full rounded-sm overflow-hidden"
          style={{
            background: style.bg,
            borderTop: style.border,
            borderBottom: style.border,
          }}
        >
          {/* Center dashed line */}
          <div
            className="absolute top-1/2 left-0 right-0"
            style={{ borderTop: style.centerLine, transform: "translateY(-0.5px)" }}
          />
          {/* Car – sits on the bottom of the lane */}
          <img
            src={carSrc}
            alt={`${label} car`}
            className="absolute bottom-0 h-10 w-auto transition-all duration-500"
            style={{ left: `${pct}%`, imageRendering: "pixelated" }}
          />
        </div>
      </div>
      {/* Commit count below car */}
      <div className="flex items-center">
        <span className="w-10 shrink-0" />
        <div className="flex-1 relative h-5">
          <span
            className="font-mono text-[10px] absolute"
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

export default function RaceTrack({
  yourCommits,
  theirCommits,
  theirLabel = "them",
  trackStyle = "asphalt",
}: RaceTrackProps) {
  const max = Math.max(yourCommits, theirCommits, 1);
  const TRACK_END = 75;
  const youPct = (yourCommits / max) * TRACK_END;
  const themPct = (theirCommits / max) * TRACK_END;
  const youWin = yourCommits >= theirCommits;
  const style = laneStyles[trackStyle];

  return (
    <div className="relative pr-14">
      {/* Shared finish line – centered between both lanes */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center">
        <img
          src="/finish-line.png"
          alt="finish"
          className="h-20 w-auto"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      {/* You lane */}
      <Lane
        label="you"
        carSrc={youWin ? "/car-green.png" : "/car-gray.png"}
        pct={youPct}
        commits={yourCommits}
        isWinner={youWin}
        style={style}
      />

      {/* Them lane */}
      <Lane
        label={theirLabel}
        carSrc={!youWin ? "/car-green.png" : "/car-gray.png"}
        pct={themPct}
        commits={theirCommits}
        isWinner={!youWin}
        style={style}
      />
    </div>
  );
}
