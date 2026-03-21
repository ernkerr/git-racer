import { useState } from "react";
import type { ContributionDay } from "@git-racer/shared";

const LEVEL_COLORS = [
  "bg-gray-800",        // level 0: no contributions
  "bg-green-900",       // level 1
  "bg-green-700",       // level 2
  "bg-green-500",       // level 3
  "bg-green-400",       // level 4
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

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

  // Organize days into weeks (columns) of 7 days (rows: Sun-Sat)
  // Start from the first Sunday on or before the first day
  const firstDate = new Date(days[0].date + "T00:00:00");
  const startDay = firstDate.getDay(); // 0=Sun
  const paddedDays: (ContributionDay | null)[] = [];

  // Pad beginning to align to Sunday
  for (let i = 0; i < startDay; i++) {
    paddedDays.push(null);
  }
  paddedDays.push(...days);

  // Pad end to complete the last week
  while (paddedDays.length % 7 !== 0) {
    paddedDays.push(null);
  }

  const weeks: (ContributionDay | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  // Compute month labels
  const monthPositions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < weeks.length; col++) {
    // Find first non-null day in the week
    const firstDay = weeks[col].find((d) => d !== null);
    if (firstDay) {
      const month = new Date(firstDay.date + "T00:00:00").getMonth();
      if (month !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[month], col });
        lastMonth = month;
      }
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">
          {totalYear.toLocaleString()} contributions in the last year
        </h3>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-0.5" style={{ position: "relative" }}>
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 flex-shrink-0">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-[11px] text-[9px] text-gray-500 leading-[11px] w-6 text-right pr-1">
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div>
            {/* Month labels */}
            <div className="flex gap-0.5 mb-0.5" style={{ height: "12px" }}>
              {weeks.map((_, col) => {
                const monthLabel = monthPositions.find((m) => m.col === col);
                return (
                  <div key={col} className="w-[11px] text-[9px] text-gray-500 flex-shrink-0">
                    {monthLabel?.label ?? ""}
                  </div>
                );
              })}
            </div>

            {/* Contribution squares */}
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <div key={row} className="flex gap-0.5">
                {weeks.map((week, col) => {
                  const day = week[row];
                  if (!day) {
                    return <div key={col} className="w-[11px] h-[11px]" />;
                  }
                  return (
                    <div
                      key={col}
                      className={`w-[11px] h-[11px] rounded-[2px] ${LEVEL_COLORS[day.level]} cursor-pointer`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          text: `${day.count} contribution${day.count !== 1 ? "s" : ""} on ${formatDate(day.date)}`,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-gray-500">
        <span>Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${color}`} />
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
