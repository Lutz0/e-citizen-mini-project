import { useId, useState } from "react";
import { ChevronDown, CircleAlert, Eye, EyeOff } from "lucide-react";

/**
 * Accessible form-field building blocks.
 *
 * Each field renders a real <label>, ties hint + error text to the control via
 * aria-describedby, flags invalid state with aria-invalid, and shows errors as
 * icon + text (never colour alone).
 */
const CONTROL =
  "block w-full rounded-lg border bg-white px-3 text-base text-ink placeholder:text-ink-3 " +
  "disabled:bg-page disabled:text-ink-3 aria-[invalid=true]:border-danger-600 aria-[invalid=true]:bg-danger-50/40";
const CONTROL_BORDER = "border-field hover:border-ink-2";

export function FieldShell({ label, hint, error, optional = false, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-3">(optional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? "true" : undefined })}
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Decorative icon inside the left edge of an input (the label still carries the meaning). */
function LeadingIcon({ icon: Icon }) {
  return Icon ? (
    <Icon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
  ) : null;
}

export function TextField({ label, hint, error, optional, icon, className = "", ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(aria) => (
        <div className="relative">
          <LeadingIcon icon={icon} />
          <input className={`${CONTROL} ${CONTROL_BORDER} h-11 ${icon ? "pl-10" : ""} ${className}`} {...aria} {...props} />
        </div>
      )}
    </FieldShell>
  );
}

export function PasswordField({ label, hint, error, icon, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {(aria) => (
        <div className="relative">
          <LeadingIcon icon={icon} />
          <input
            className={`${CONTROL} ${CONTROL_BORDER} h-11 pr-12 ${icon ? "pl-10" : ""}`}
            type={visible ? "text" : "password"}
            {...aria}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-2 hover:text-ink"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, optional, counter, rows = 5, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(aria) => (
        <>
          <textarea className={`${CONTROL} ${CONTROL_BORDER} py-2.5 leading-relaxed`} rows={rows} {...aria} {...props} />
          {counter && (
            <p className={`mt-1 text-right text-xs ${counter.over ? "font-semibold text-danger-600" : "text-ink-3"}`}>
              {counter.text}
            </p>
          )}
        </>
      )}
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, optional, options, placeholder, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {(aria) => (
        <div className="relative">
          <select className={`${CONTROL} ${CONTROL_BORDER} h-11 appearance-none pr-10`} {...aria} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-2"
            aria-hidden="true"
          />
        </div>
      )}
    </FieldShell>
  );
}

/** Compact select used in filter bars (label visually hidden but present). */
export function FilterSelect({ label, options, placeholder, value, onChange, className = "" }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${CONTROL} ${CONTROL_BORDER} h-10 appearance-none py-0 pr-9 text-sm`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
