import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CircleCheck, box: "border-success-200 bg-success-50 text-success-700", label: "Success" },
  error: { icon: CircleAlert, box: "border-danger-200 bg-danger-50 text-danger-700", label: "Error" },
  info: { icon: Info, box: "border-brand-200 bg-brand-50 text-brand-700", label: "Notice" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback(
    (kind, message) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 10000 : 6000);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Live regions exist from first render so assistive tech announces new toasts. */}
      <div data-toast-region className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
        <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
          {toasts
            .filter((toast) => toast.kind !== "error")
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
        <div role="alert" className="flex w-full max-w-sm flex-col gap-2">
          {toasts
            .filter((toast) => toast.kind === "error")
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const { icon: Icon, box, label } = STYLES[toast.kind];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-pop ${box}`}
      style={{ animation: "toast-in 0.2s ease-out" }}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">
        <span className="sr-only">{label}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 rounded-md p-1 hover:bg-black/5"
        aria-label="Dismiss message"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
