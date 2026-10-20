import { useMemo, useState } from "react";
import { useElementWidth } from "../../hooks/useElementWidth.js";
import { compactNumber, labelIndexes, niceScale } from "../../utils/chart.js";
import { formatDayLabel } from "../../utils/format.js";
import { ChartCard, LegendItem } from "./ChartCard.jsx";

const SERIES = [
  { key: "submitted", label: "Submitted", color: "var(--series-pending)" },
  { key: "resolved", label: "Resolved", color: "var(--series-resolved)" },
];

const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 34 };

/**
 * Daily requests submitted vs resolved: two 2px lines on ONE shared axis.
 * Hover (or arrow keys) moves a crosshair to the nearest day and one tooltip
 * lists every series. The table view lists the same numbers.
 */
export function TrendChart({ points, days, refreshing }) {
  const [containerRef, width] = useElementWidth(640);
  const [active, setActive] = useState(null); // index of the highlighted day

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const { top, ticks } = useMemo(
    () => niceScale(Math.max(...points.flatMap((p) => [p.submitted, p.resolved]), 0)),
    [points],
  );

  const x = (index) => MARGIN.left + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : plotWidth / 2);
  const y = (value) => MARGIN.top + plotHeight - (value / top) * plotHeight;

  const totals = Object.fromEntries(SERIES.map((s) => [s.key, points.reduce((sum, p) => sum + p[s.key], 0)]));
  const noActivity = totals.submitted === 0 && totals.resolved === 0;

  function indexFromPointer(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - MARGIN.left) / plotWidth;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
  }

  function handleKeyDown(event) {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (move) {
      event.preventDefault();
      setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? points.length) + move)));
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(points.length - 1);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const activePoint = active === null ? null : points[active];
  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active), 80), width - 80);
  const summary =
    `Line chart of requests per day for the last ${days} days. ` +
    `${totals.submitted} submitted and ${totals.resolved} resolved in total. ` +
    "Use the left and right arrow keys to read each day, or switch to the table view.";

  return (
    <ChartCard
      title="Submitted vs resolved"
      description={`Requests per day, last ${days} days`}
      refreshing={refreshing}
      legend={
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
          {SERIES.map((series) => (
            <LegendItem key={series.key} shape="line" color={series.color} label={series.label} value={totals[series.key]} />
          ))}
        </ul>
      }
      chart={() => (
        <div ref={containerRef} className="relative">
          <div
            role="group"
            tabIndex={0}
            aria-label={summary}
            onKeyDown={handleKeyDown}
            onFocus={() => setActive((current) => current ?? points.length - 1)}
            onBlur={() => setActive(null)}
            onPointerMove={(event) => setActive(indexFromPointer(event))}
            onPointerLeave={() => setActive(null)}
            className="rounded-md"
            style={{ touchAction: "pan-y" }}
          >
            <svg width={width} height={HEIGHT} aria-hidden="true" className="block max-w-full select-none">
              {/* gridlines + y labels */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
                    strokeWidth="1"
                  />
                  <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--color-ink-3)">
                    {compactNumber(tick)}
                  </text>
                </g>
              ))}

              {/* x labels */}
              {labelIndexes(points.length, plotWidth).map((index) => (
                <text
                  key={index}
                  x={x(index)}
                  y={HEIGHT - 8}
                  textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                  fontSize="12"
                  fill="var(--color-ink-3)"
                >
                  {formatDayLabel(points[index].date)}
                </text>
              ))}

              {/* crosshair */}
              {active !== null && (
                <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--chart-axis)" strokeWidth="1" />
              )}

              {/* lines, end dots (surface ring) and active dots */}
              {SERIES.map((series) => {
                const path = points.map((p, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(p[series.key])}`).join(" ");
                const last = points.length - 1;
                return (
                  <g key={series.key}>
                    <path d={path} fill="none" stroke={series.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(last)} cy={y(points[last][series.key])} r="5" fill={series.color} stroke="#fff" strokeWidth="2" />
                    {active !== null && active !== last && (
                      <circle cx={x(active)} cy={y(points[active][series.key])} r="5" fill={series.color} stroke="#fff" strokeWidth="2" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {activePoint && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border border-line bg-white p-3 text-sm shadow-pop"
              style={{ left: tipLeft }}
            >
              <p className="font-semibold text-ink">{formatDayLabel(activePoint.date)}</p>
              <ul className="mt-1.5 space-y-1">
                {SERIES.map((series) => (
                  <li key={series.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: series.color }} />
                    <span className="font-semibold text-ink">{activePoint[series.key]}</span>
                    <span className="text-ink-2">{series.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {noActivity && (
            <p className="mt-2 text-center text-sm text-ink-2">No requests were submitted or resolved in this period.</p>
          )}
        </div>
      )}
      table={() => (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Requests submitted and resolved per day</caption>
            <thead className="sticky top-0 border-b border-line bg-white text-xs uppercase tracking-wide text-ink-2">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Submitted</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <th scope="row" className="py-1.5 pr-3 font-medium text-ink">{formatDayLabel(p.date)}</th>
                  <td className="px-3 py-1.5 text-right">{p.submitted}</td>
                  <td className="py-1.5 pl-3 text-right">{p.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}
