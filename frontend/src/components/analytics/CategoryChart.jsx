import { useState } from "react";
import { byValue, CATEGORIES } from "../../utils/constants.js";
import { ChartCard, LegendItem } from "./ChartCard.jsx";

const SERIES = [
  { key: "pending", label: "Pending", color: "var(--series-pending)" },
  { key: "in_progress", label: "In Progress", color: "var(--series-progress)" },
  { key: "resolved", label: "Resolved", color: "var(--series-resolved)" },
];

const describe = (row) =>
  `${row.label}: ${row.total} ${row.total === 1 ? "request" : "requests"}. ` +
  SERIES.map((series) => `${row[series.key]} ${series.label}`).join(", ");

function Row({ row, max, onHover, active }) {
  const Icon = byValue(CATEGORIES, row.category)?.icon;
  // Leave room on the right for the value label so the longest bar never overflows its track.
  const barWidth = `calc((100% - 2.75rem) * ${row.total / max})`;
  const visible = SERIES.filter((series) => row[series.key] > 0);

  return (
    <li
      tabIndex={0}
      aria-label={describe(row)}
      onPointerEnter={(event) => onHover(row, event)}
      onPointerMove={(event) => onHover(row, event)}
      onPointerLeave={() => onHover(null)}
      onFocus={(event) => onHover(row, event, true)}
      onBlur={() => onHover(null)}
      className={`grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-x-3 rounded-md px-1 py-1.5 sm:grid-cols-[9.5rem_1fr] ${
        active ? "bg-page" : ""
      }`}
    >
      <span className="flex items-center gap-2 text-sm text-ink">
        {Icon && <Icon className="hidden size-4 shrink-0 text-ink-3 sm:block" aria-hidden="true" />}
        <span className="truncate">{row.label}</span>
      </span>
      <span className="flex items-center gap-2" aria-hidden="true">
        {/* Bars grow from one baseline. 2px surface gaps separate segments; only the data end is rounded. */}
        <span className="flex h-5 gap-0.5" style={{ width: barWidth }}>
          {visible.map((series, index) => (
            <span
              key={series.key}
              className={index === visible.length - 1 ? "rounded-r" : ""}
              style={{ flex: `${row[series.key]} 1 0`, minWidth: 4, background: series.color }}
            />
          ))}
        </span>
        <span className="w-8 text-sm font-semibold text-ink">{row.total}</span>
      </span>
    </li>
  );
}

export function CategoryChart({ rows, refreshing }) {
  const [tip, setTip] = useState(null); // { row, x, y }
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  const max = Math.max(...rows.map((row) => row.total), 1);
  const empty = rows.every((row) => row.total === 0);

  function handleHover(row, event, fromFocus = false) {
    if (!row) return setTip(null);
    const box = event.currentTarget.closest("[data-chart]").getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    setTip({
      row,
      x: fromFocus ? 24 : Math.min(Math.max(event.clientX - box.left, 8), box.width - 8),
      y: target.top - box.top,
    });
  }

  return (
    <ChartCard
      title="Requests by category"
      description="All time, split by status"
      refreshing={refreshing}
      legend={
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
          {SERIES.map((series) => (
            <LegendItem key={series.key} color={series.color} label={series.label} />
          ))}
        </ul>
      }
      chart={() =>
        empty ? (
          <p className="py-8 text-center text-ink-2">No requests yet, so there's nothing to chart.</p>
        ) : (
          <div data-chart className="relative">
            <ul>
              {sorted.map((row) => (
                <Row key={row.category} row={row} max={max} onHover={handleHover} active={tip?.row.category === row.category} />
              ))}
            </ul>
            {tip && (
              <div
                role="presentation"
                className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white p-3 text-sm shadow-pop"
                style={{ left: Math.min(Math.max(tip.x, 104), 9999), top: tip.y - 4 }}
              >
                <p className="font-semibold text-ink">{tip.row.label}</p>
                <ul className="mt-1.5 space-y-1">
                  {SERIES.map((series) => (
                    <li key={series.key} className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: series.color }} />
                      <span className="font-semibold text-ink">{tip.row[series.key]}</span>
                      <span className="text-ink-2">{series.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      }
      table={() => (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Requests by category and status</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-2">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Category</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pending</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">In Progress</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Resolved</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Unresolved</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {sorted.map((row) => (
                <tr key={row.category}>
                  <th scope="row" className="py-2 pr-3 font-medium text-ink">{row.label}</th>
                  <td className="px-3 py-2 text-right">{row.pending}</td>
                  <td className="px-3 py-2 text-right">{row.in_progress}</td>
                  <td className="px-3 py-2 text-right">{row.resolved}</td>
                  <td className="px-3 py-2 text-right">{row.unresolved}</td>
                  <td className="py-2 pl-3 text-right font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}
