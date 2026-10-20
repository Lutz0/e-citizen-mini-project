const SEGMENTS = [
  { key: "pending", label: "Pending", color: "var(--series-pending)" },
  { key: "in_progress", label: "In Progress", color: "var(--series-progress)" },
  { key: "resolved", label: "Resolved", color: "var(--series-resolved)" },
];

/**
 * One stacked bar showing how all requests split across the three statuses.
 * Segments are separated by a 2px surface gap (not borders). A text legend with
 * counts and percentages sits underneath so nothing depends on colour alone.
 */
export function StatusMixBar({ totals }) {
  const total = totals.total;
  const summary = SEGMENTS.map((segment) => `${totals[segment.key]} ${segment.label}`).join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={total ? `Status mix of ${total} requests: ${summary}` : "No requests yet"}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-line"
      >
        {total > 0 &&
          SEGMENTS.filter((segment) => totals[segment.key] > 0).map((segment) => (
            <div
              key={segment.key}
              style={{ width: `${(totals[segment.key] / total) * 100}%`, background: segment.color }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
        {SEGMENTS.map((segment) => {
          const count = totals[segment.key];
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <li key={segment.key} className="flex items-center gap-2 text-ink-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: segment.color }} />
              <span>
                {segment.label}: <span className="font-semibold text-ink">{count}</span>
                <span className="text-ink-3"> ({percent}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
