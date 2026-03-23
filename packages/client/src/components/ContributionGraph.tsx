import { useState } from "react";
import type { ContributionDay } from "@git-racer/shared";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  days: ContributionDay[];
  totalYear: number;
}

export default function ContributionGraph({ days, totalYear }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (days.length === 0) {
    return (
      <div className="font-pixel text-sm text-arcade-gray text-center py-8">NO CONTRIBUTION DATA YET.</div>
    );
  }

  // Build a 7-row (Sun-Sat) x N-column (weeks) grid
  const firstDate = new Date(days[0].date + "T12:00:00");
  const startDow = firstDate.getDay();

  const cells: (ContributionDay | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);

  const numWeeks = cells.length / 7;

  const weeks: (ContributionDay | null)[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  const monthLabels: { label: string; col: number }[] = [];
  let prevMonth = -1;
  for (let col = 0; col < weeks.length; col++) {
    const firstDay = weeks[col].find((d) => d !== null);
    if (firstDay) {
      const m = new Date(firstDay.date + "T12:00:00").getMonth();
      if (m !== prevMonth) {
        monthLabels.push({ label: MONTH_LABELS[m], col });
        prevMonth = m;
      }
    }
  }

  const cellSize = 11;
  const gap = 2;
  const step = cellSize + gap;
  const labelWidth = 28;
  const headerHeight = 14;
  const svgWidth = labelWidth + numWeeks * step;
  const svgHeight = headerHeight + 7 * step;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="font-pixel text-xs text-arcade-gray">
          {totalYear.toLocaleString()} CONTRIBUTIONS THIS YEAR
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          style={{ minWidth: svgWidth }}
        >
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelWidth + m.col * step}
              y={10}
              style={{ fill: "var(--arcade-muted)" }}
              fontSize={9}
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {["Mon", "Wed", "Fri"].map((label, i) => (
            <text
              key={label}
              x={labelWidth - 4}
              y={headerHeight + [1, 3, 5][i] * step + cellSize - 1}
              style={{ fill: "var(--arcade-muted)" }}
              fontSize={9}
              textAnchor="end"
            >
              {label}
            </text>
          ))}

          {/* Squares */}
          {weeks.map((week, col) =>
            week.map((day, row) => {
              if (!day) return null;
              const x = labelWidth + col * step;
              const y = headerHeight + row * step;
              const fill = levelToColor(day.level);
              return (
                <rect
                  key={`${col}-${row}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={0}
                  fill={fill}
                  style={{ stroke: "var(--arcade-border)" }}
                  strokeWidth={0.5}
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({
                      text: `${day.count} contribution${day.count !== 1 ? "s" : ""} on ${formatDate(day.date)}`,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="font-pixel text-xs text-arcade-gray mr-1">LESS</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="w-[10px] h-[10px] border border-arcade-border"
            style={{ backgroundColor: levelToColor(level) }}
          />
        ))}
        <span className="font-pixel text-xs text-arcade-gray ml-1">MORE</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 text-xs px-2 py-1 pointer-events-none whitespace-nowrap border-2"
          style={{
            backgroundColor: "var(--arcade-text)",
            color: "var(--arcade-bg)",
            borderColor: "var(--arcade-border)",
            boxShadow: "3px 3px 0px var(--arcade-shadow)",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

function levelToColor(level: number): string {
  switch (level) {
    case 0: return "var(--contrib-0)";
    case 1: return "var(--contrib-1)";
    case 2: return "var(--contrib-2)";
    case 3: return "var(--contrib-3)";
    case 4: return "var(--contrib-4)";
    default: return "var(--contrib-0)";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
