import { useState } from "react";
import type { ContributionDay } from "@git-racer/shared";

const LEVEL_COLORS = [
  "bg-gray-800",
  "bg-green-900",
  "bg-green-700",
  "bg-green-500",
  "bg-green-400",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  days: ContributionDay[];
  totalYear: number;
}

export default function ContributionGraph({ days, totalYear }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (days.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">No contribution data yet.</div>
    );
  }

  // Build a 7-row (Sun-Sat) x N-column (weeks) grid
  const firstDate = new Date(days[0].date + "T12:00:00");
  const startDow = firstDate.getDay(); // 0=Sun

  // Pad front so first day lands on the correct row
  const cells: (ContributionDay | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  cells.push(...days);
  // Pad end to fill last column
  while (cells.length % 7 !== 0) cells.push(null);

  const numWeeks = cells.length / 7;

  // Build week columns
  const weeks: (ContributionDay | null)[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  // Month label positions (which column index a new month starts)
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
        <p className="text-sm font-medium text-gray-400">
          {totalYear.toLocaleString()} contributions in the last year
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
              className="fill-gray-500"
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
              className="fill-gray-500"
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
              const colorClass = LEVEL_COLORS[day.level];
              // Map tailwind colors to hex for SVG
              const fill = levelToColor(day.level);
              return (
                <rect
                  key={`${col}-${row}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={fill}
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
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-500">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ backgroundColor: levelToColor(level) }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-700 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
          style={{
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
    case 0: return "#1f2937"; // gray-800
    case 1: return "#14532d"; // green-900
    case 2: return "#15803d"; // green-700
    case 3: return "#22c55e"; // green-500
    case 4: return "#4ade80"; // green-400
    default: return "#1f2937";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
