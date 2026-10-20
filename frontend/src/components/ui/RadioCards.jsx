import { useId } from "react";
import { CircleAlert } from "lucide-react";

/**
 * A group of mutually exclusive choices drawn as selectable cards.
 * Real radio inputs underneath, so keyboard (arrow keys), screen readers and
 * form semantics all work; the card styling is driven by the :checked state.
 */
export function RadioCards({ legend, hint, error, name, value, onChange, options, columns = "grid-cols-1 sm:grid-cols-2", compact = false, stacked = false }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <fieldset aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined} aria-invalid={error ? "true" : undefined}>
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      {hint && (
        <p id={hintId} className="mb-2 text-sm text-ink-2">
          {hint}
        </p>
      )}
      <div className={`grid gap-3 ${columns}`}>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <label key={option.value} className="relative block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(name, option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex h-full ${stacked ? "flex-col items-start gap-2" : "items-start gap-3"} rounded-lg border border-line-strong bg-white ${compact ? "p-3" : "p-4"} transition-colors
                  hover:border-brand-500 peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:ring-1 peer-checked:ring-brand-600
                  peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600`}
              >
                {Icon && (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug text-ink">{option.label}</span>
                  {(option.example || option.hint) && (
                    <span className="mt-0.5 block text-sm leading-snug text-ink-2">{option.example || option.hint}</span>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
