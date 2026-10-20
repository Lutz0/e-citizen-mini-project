import { CloudOff, Inbox } from "lucide-react";
import { Button } from "./Button.jsx";

/** Nothing to show yet (or nothing matches the filters). */
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A failed load, with a way to try again. Shows the server's friendly message only. */
export function ErrorState({ error, onRetry, title = "We couldn't load this" }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <CloudOff className="size-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-ink-2">{error?.detail || "Something went wrong. Please try again."}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
