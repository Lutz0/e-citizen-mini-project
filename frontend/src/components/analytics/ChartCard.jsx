import { useId, useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { Card, CardHeader } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";

/**
 * Frame for a chart: title, a "table view" toggle (every value is reachable
 * without hover or colour) and the legend slot. `chart` and `table` are render
 * props so only the active view is mounted.
 */
export function ChartCard({ title, description, legend, chart, table, footer, refreshing = false }) {
  const [showTable, setShowTable] = useState(false);
  const headingId = useId();
  const Icon = showTable ? ChartColumn : Table2;

  return (
    <Card as="section" aria-labelledby={headingId} aria-busy={refreshing || undefined} className="min-w-0">
      <CardHeader
        id={headingId}
        title={title}
        description={description}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={Icon}
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? "View as chart" : "View as table"}
          </Button>
        }
      />
      <div className={`px-5 pb-5 pt-4 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {!showTable && legend}
        <div className={!showTable && legend ? "mt-4" : ""}>{showTable ? table() : chart()}</div>
        {footer && <div className="mt-4 text-sm text-ink-2">{footer}</div>}
      </div>
    </Card>
  );
}

/** Legend entry: a swatch (square for bars, short line for lines) + text label. */
export function LegendItem({ color, label, value, shape = "square" }) {
  return (
    <li className="flex items-center gap-2 text-sm text-ink-2">
      <span
        aria-hidden="true"
        className={shape === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-sm"}
        style={{ background: color }}
      />
      <span>
        {label}
        {value !== undefined && <span className="ml-1.5 font-semibold text-ink">{value}</span>}
      </span>
    </li>
  );
}
