import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const VARIANTS = {
  info: { icon: Info, box: "border-brand-200 bg-brand-50 text-brand-800", role: "status" },
  success: { icon: CircleCheck, box: "border-success-200 bg-success-50 text-success-700", role: "status" },
  warning: { icon: TriangleAlert, box: "border-warning-200 bg-warning-50 text-warning-700", role: "status" },
  error: { icon: CircleAlert, box: "border-danger-200 bg-danger-50 text-danger-700", role: "alert" },
};

/** Inline message banner. Errors use role="alert" so they are announced immediately. */
export function Alert({ variant = "info", title, children, className = "", action }) {
  const { icon: Icon, box, role } = VARIANTS[variant];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-xl border p-4 ${box} ${className}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
