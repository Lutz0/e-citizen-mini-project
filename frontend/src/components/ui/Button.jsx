import { Link } from "react-router";
import { LoaderCircle } from "lucide-react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-line-strong bg-white text-ink hover:bg-brand-50 hover:border-brand-200",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  "on-dark": "bg-white text-brand-900 hover:bg-brand-100",
  "outline-on-dark": "border border-white/50 text-white hover:bg-white/10",
};

const SIZES = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base", // 44px: comfortable touch target
  lg: "h-12 px-6 text-base",
};

export const buttonClasses = ({ variant = "primary", size = "md", className = "" } = {}) =>
  [BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ");

export function Button({ variant, size, loading = false, icon: Icon, className, children, disabled, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="size-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon: Icon, className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </Link>
  );
}
