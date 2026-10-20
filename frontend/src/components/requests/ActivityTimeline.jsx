import { CircleCheck, Clock, Loader } from "lucide-react";
import { formatDateTime } from "../../utils/format.js";

const ICONS = { pending: Clock, in_progress: Loader, resolved: CircleCheck };
const TONES = {
  pending: "bg-pending-50 text-pending-700",
  in_progress: "bg-progress-50 text-progress-700",
  resolved: "bg-resolved-50 text-resolved-700",
};

function describe(change) {
  if (!change.from_status) return "Request submitted";
  return `Status changed from ${change.from_status_label} to ${change.to_status_label}`;
}

/** The audit trail: every lifecycle event with who did it and when, oldest first. */
export function ActivityTimeline({ changes }) {
  return (
    <ol className="relative space-y-5" aria-label="Status history">
      {changes.map((change, index) => {
        const Icon = ICONS[change.to_status] ?? Clock;
        return (
          <li key={change.id} className="relative flex gap-3">
            {index < changes.length - 1 && (
              <span aria-hidden="true" className="absolute left-4 top-9 -bottom-5 w-px -translate-x-1/2 bg-line-strong" />
            )}
            <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${TONES[change.to_status] ?? ""}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-medium text-ink">{describe(change)}</p>
              <p className="text-sm text-ink-2">
                {change.changed_by_name} · <time dateTime={change.created_at}>{formatDateTime(change.created_at)}</time>
              </p>
              {change.note && change.from_status && (
                <p className="mt-1.5 rounded-lg bg-page px-3 py-2 text-sm text-ink whitespace-pre-line">{change.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
