import { useState } from "react";

interface DayData {
  date: string;
  count: number;
}

interface RacePathProps {
  you: DayData[];
  rival?: { username: string; data: DayData[] } | null;
  label?: string;
}

/** Merge two sparse day arrays into a unified date axis, filling missing days with 0. */
function buildAxis(a: DayData[], b?: DayData[]): string[] {
  const dates = new Set<string>();
  a.forEach((d) => dates.add(d.date));
  b?.forEach((d) => dates.add(d.date));
  return Array.from(dates).sort();
}

function toMap(days: DayData[]): Map<string, number> {
  return new Map(days.map((d) => [d.date, d.count]));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RacePath({ you, rival, label = "LAST 30 DAYS" }: RacePathProps) {
  const [hover, setHover] = useState<{ date: string; x: number } | null>(null);
  const axis = buildAxis(you, rival?.data);
  const youMap = toMap(you);
  const rivalMap = rival ? toMap(rival.data) : null;

  const allCounts = axis.flatMap((d) => {
    const y = youMap.get(d) ?? 0;
    const r = rivalMap?.get(d) ?? 0;
    return [y, r];
  });
  const peak = Math.max(...allCounts, 1);

  const BAR_H = 140; // max bar height in px
  const GAP = rival ? 1 : 2; // px gap between bars
  const firstDate = axis[0] ?? "";
  const lastDate = axis[axis.length - 1] ?? "";

  return (
    <div className="retro-box bg-arcade-surface p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="font-pixel text-xs text-arcade-white tracking-widest">RACE PATH</p>
          <p className="font-mono text-[10px] text-arcade-gray mt-0.5">CONTRIBUTION VELOCITY</p>
        </div>
        <div className="flex items-center gap-3">
          {rival && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-pixel text-[10px] text-arcade-white">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: "#00C853" }} />
                YOU
              </span>
              <span className="flex items-center gap-1 font-pixel text-[10px] text-arcade-white">
                <span className="inline-block w-2 h-2" style={{ backgroundColor: "#00FF87" }} />
                {rival.username.toUpperCase().slice(0, 8)}
              </span>
            </div>
          )}
          <span
            className="font-pixel text-[10px] px-2 py-1 border-2"
            style={{ borderColor: "#00E676", color: "#00E676" }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="relative flex items-end gap-px mt-4 overflow-hidden"
        style={{ height: `${BAR_H}px`, gap: `${GAP}px` }}
        onMouseLeave={() => setHover(null)}
      >
        {axis.map((date) => {
          const y = youMap.get(date) ?? 0;
          const r = rivalMap?.get(date) ?? 0;
          const yH = Math.max(1, Math.round((y / peak) * BAR_H));
          const rH = Math.max(r > 0 ? 1 : 0, Math.round((r / peak) * BAR_H));
          const isHovered = hover?.date === date;

          const barProps = {
            onMouseEnter: (e: React.MouseEvent) => {
              const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement)?.getBoundingClientRect();
              const barRect = e.currentTarget.getBoundingClientRect();
              const x = barRect.left + barRect.width / 2 - (rect?.left ?? 0);
              setHover({ date, x });
            },
          };

          if (rival) {
            return (
              <div key={date} className="flex items-end gap-px flex-1 min-w-0" {...barProps}>
                <div
                  className="flex-1 min-w-0 transition-opacity"
                  style={{ height: `${yH}px`, backgroundColor: "#00C853", opacity: hover && !isHovered ? 0.4 : 1 }}
                />
                <div
                  className="flex-1 min-w-0 transition-opacity"
                  style={{ height: `${rH}px`, backgroundColor: "#00FF87", opacity: hover && !isHovered ? 0.4 : 1 }}
                />
              </div>
            );
          }

          return (
            <div
              key={date}
              className="flex-1 min-w-0 transition-opacity"
              style={{ height: `${yH}px`, backgroundColor: "#00FF87", opacity: hover && !isHovered ? 0.4 : 1 }}
              {...barProps}
            />
          );
        })}

        {/* Tooltip */}
        {hover && (() => {
          const y = youMap.get(hover.date) ?? 0;
          const r = rivalMap?.get(hover.date) ?? 0;
          return (
            <div
              className="absolute bottom-full mb-2 pointer-events-none z-10"
              style={{ left: `${hover.x}px`, transform: "translateX(-50%)" }}
            >
              <div className="bg-arcade-bg border-2 border-arcade-border px-3 py-2 whitespace-nowrap">
                <p className="font-mono text-[10px] text-arcade-gray mb-1">{formatDate(hover.date)}</p>
                <p className="font-pixel text-xs text-arcade-white">
                  {y} commit{y !== 1 ? "s" : ""}
                </p>
                {rival && (
                  <p className="font-pixel text-xs" style={{ color: "#00FF87" }}>
                    {rival.username}: {r}
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom axis labels */}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-[10px] text-arcade-gray">
          {firstDate ? formatDate(firstDate) : ""}
        </span>
        <span className="font-mono text-[10px] text-arcade-gray">
          {lastDate ? formatDate(lastDate) : ""}
        </span>
      </div>
    </div>
  );
}
