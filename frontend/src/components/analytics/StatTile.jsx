import { Link } from "react-router";
import { Skeleton } from "../ui/Loading.jsx";

/**
 * Headline number. `color` is a CSS colour (a status/series variable) shown as a
 * small marker so the tile reads as the same entity as its badge and chart colour;
 * the label always carries the meaning in words.
 */
export function StatTile({ label, value, hint, color, to, active = false, loading = false, emphasis = false, className = "" }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-2">
        {color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-16" />
      ) : (
        <p className={`mt-1 font-semibold leading-none text-ink ${emphasis ? "text-4xl" : "text-3xl"}`}>{value}</p>
      )}
      {hint && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
    </>
  );

  const classes = `block rounded-xl border bg-white p-4 shadow-card ${
    active ? "border-brand-600 ring-2 ring-brand-600" : emphasis ? "border-brand-200 bg-brand-50/50" : "border-line"
  } ${to ? "transition-colors hover:border-brand-500" : ""} ${className}`;

  return to ? (
    <Link to={to} className={classes} aria-current={active ? "true" : undefined}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
