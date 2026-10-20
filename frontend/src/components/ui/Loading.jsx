import { LoaderCircle } from "lucide-react";

export function Spinner({ label = "Loading", className = "size-5" }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Centered loader for whole-page waits. */
export function PageLoader({ label = "Loading" }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-2">
      <Spinner label={label} className="size-8" />
      <p aria-hidden="true" className="text-sm">
        {label}…
      </p>
    </div>
  );
}

/** Grey placeholder block that pulses gently while content loads. */
export function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-line ${className}`}
      style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }}
    />
  );
}
