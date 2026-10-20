import { Check } from "lucide-react";
import { formatDateTime } from "../../utils/format.js";

const STEPS = [
  { status: "pending", label: "Pending", caption: "Submitted", timeKey: "created_at", fill: "bg-pending-700 border-pending-700" },
  { status: "in_progress", label: "In Progress", caption: "Work started", timeKey: "in_progress_at", fill: "bg-progress-700 border-progress-700" },
  { status: "resolved", label: "Resolved", caption: "Issue fixed", timeKey: "resolved_at", fill: "bg-resolved-700 border-resolved-700" },
];

/**
 * Shows where a request is in Pending -> In Progress -> Resolved, with the time
 * each stage was reached. State is conveyed by icon, text and (visually hidden)
 * labels as well as colour.
 */
export function StatusStepper({ request }) {
  const currentIndex = STEPS.findIndex((step) => step.status === request.status);
  const finished = request.status === "resolved";

  return (
    <ol className="grid grid-cols-3" aria-label="Request progress">
      {STEPS.map((step, index) => {
        const done = index < currentIndex || (finished && index === currentIndex);
        const current = index === currentIndex && !finished;
        const reached = done || current;
        const time = request[step.timeKey];
        const stateText = done ? "completed" : current ? "current stage" : "not reached yet";

        return (
          <li key={step.status} className="relative flex flex-col items-center px-1 text-center" aria-current={current ? "step" : undefined}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${index <= currentIndex ? "bg-ink-2/60" : "bg-line-strong"}`}
              />
            )}
            <span
              className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 ${
                reached ? `${step.fill} text-white` : "border-line-strong bg-white text-ink-3"
              } ${current ? "ring-4 ring-brand-200" : ""}`}
              aria-hidden="true"
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <span className="text-xs font-bold">{index + 1}</span>}
            </span>
            <span className={`mt-2 text-sm font-semibold ${reached ? "text-ink" : "text-ink-3"}`}>
              {step.label}
              <span className="sr-only"> ({stateText})</span>
            </span>
            <span className="text-xs text-ink-3">{reached && time ? step.caption : "—"}</span>
            <span className="text-xs text-ink-2">{reached && time ? formatDateTime(time) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
