import { CircleCheck, Clock, Loader } from "lucide-react";
import { byValue, CATEGORIES, SEVERITIES, STATUSES } from "../../utils/constants.js";

/**
 * Status badge. Colour is never the only signal: every status also has its own
 * icon and a text label. Text/background pairs all meet WCAG AA (>= 4.5:1).
 */
const STATUS_STYLE = {
  pending: { icon: Clock, classes: "bg-pending-50 text-pending-700" },
  in_progress: { icon: Loader, classes: "bg-progress-50 text-progress-700" },
  resolved: { icon: CircleCheck, classes: "bg-resolved-50 text-resolved-700" },
};

export function StatusBadge({ status, className = "" }) {
  const style = STATUS_STYLE[status];
  const label = byValue(STATUSES, status)?.label ?? status;
  const Icon = style?.icon;
  return (
    <span
      className={`badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ring-1 ring-inset ring-current/25 ${style?.classes ?? "bg-page text-ink-2"} ${className}`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}

const SEVERITY_STYLE = {
  low: "bg-page text-ink-2",
  medium: "bg-warning-50 text-warning-700",
  high: "bg-danger-50 text-danger-700",
};

/** Severity shown as 1-3 signal bars + a word, so it reads without colour. */
export function SeverityBadge({ severity, className = "" }) {
  const meta = byValue(SEVERITIES, severity);
  const level = meta?.level ?? 1;
  return (
    <span
      className={`badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ring-1 ring-inset ring-current/25 ${SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.low} ${className}`}
      title={meta?.hint}
    >
      <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <rect
            key={bar}
            x={1 + (bar - 1) * 4.5}
            y={11 - bar * 3.2}
            width="3"
            height={bar * 3.2}
            rx="0.8"
            fill="currentColor"
            opacity={bar <= level ? 1 : 0.25}
          />
        ))}
      </svg>
      <span className="sr-only">Severity: </span>
      {meta?.label ?? severity}
    </span>
  );
}

export function CategoryLabel({ category, className = "" }) {
  const meta = byValue(CATEGORIES, category);
  const Icon = meta?.icon;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {Icon && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <span>{meta?.label ?? category}</span>
    </span>
  );
}
