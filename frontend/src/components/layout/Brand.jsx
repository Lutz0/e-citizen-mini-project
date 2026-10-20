import { Link } from "react-router";
import { ShieldCheck } from "lucide-react";

/** Logo mark + name, linking home. Meant for dark (navy) backgrounds. */
export function Brand({ showTagline = true, className = "" }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 rounded-lg text-white ${className}`}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-700">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold">Public Service Requests</span>
        {showTagline && <span className="hidden text-xs text-brand-100 sm:block">Report. Track. Resolved.</span>}
      </span>
    </Link>
  );
}
