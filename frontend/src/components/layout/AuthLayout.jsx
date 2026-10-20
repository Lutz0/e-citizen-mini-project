import { useRef } from "react";
import { Link, Outlet } from "react-router";
import { ArrowLeft, Bell, ClipboardList, MapPin, Search } from "lucide-react";
import { useFocusMainOnNavigate } from "../../hooks/useFocusMainOnNavigate.js";
import { StatusBadge } from "../ui/Badges.jsx";
import { StatusStepper } from "../requests/StatusStepper.jsx";
import { Brand } from "./Brand.jsx";

const POINTS = [
  { icon: ClipboardList, text: "Report a problem in about two minutes, with a photo if you have one." },
  { icon: Search, text: "Follow every step from Pending to Resolved, with dates." },
  { icon: Bell, text: "Get an email whenever the service team updates your request." },
];

// A fixed example so the panel shows what the service looks like once you're in.
const EXAMPLE = {
  status: "in_progress",
  created_at: "2026-10-12T09:12:00+03:00",
  in_progress_at: "2026-10-13T14:40:00+03:00",
  resolved_at: null,
};

function ExampleRequest() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-white p-5 text-ink shadow-pop ring-1 ring-white/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-700">SR-2026-K7M3Q9</p>
          <p className="mt-0.5 font-semibold">Streetlights</p>
        </div>
        <StatusBadge status="in_progress" />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
        <MapPin className="size-4 shrink-0" aria-hidden="true" /> Moi Avenue, near the pharmacy
      </p>
      <div className="mt-5 border-t border-line pt-5">
        <StatusStepper request={EXAMPLE} />
      </div>
    </div>
  );
}

/**
 * Shell for the sign-in and registration pages: a branded panel (desktop) beside a roomy
 * form column. On phones the panel collapses into a compact brand bar above the form.
 */
export function AuthLayout() {
  const mainRef = useRef(null);
  useFocusMainOnNavigate(mainRef);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* Phones and tablets: compact brand bar */}
      <div className="on-dark bg-brand-900 px-5 py-3.5 lg:hidden">
        <Brand showTagline={false} />
      </div>

      {/* Desktop: branded panel */}
      <aside
        aria-label="About this service"
        className="on-dark relative hidden flex-col justify-between gap-10 overflow-hidden px-12 py-10 text-white lg:flex lg:w-[46%] xl:w-1/2 xl:px-16"
        style={{
          background:
            "radial-gradient(900px 520px at 0% -10%, rgb(47 111 196 / 0.55), transparent 60%), " +
            "radial-gradient(700px 520px at 100% 105%, rgb(29 93 176 / 0.5), transparent 55%), var(--color-brand-900)",
        }}
      >
        <Brand />

        <div className="max-w-md">
          <p className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl xl:leading-[1.1]">
            Report it. Track it. See it fixed.
          </p>
          <p className="mt-4 text-lg text-brand-100">
            Tell your local service team about problems in your community and watch each request move to resolved.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-100">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-md">
          <ExampleRequest />
        </div>
      </aside>

      {/* Form column */}
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="flex flex-1 flex-col bg-white px-6 pb-10 pt-8 outline-none sm:px-10 lg:px-14 lg:pt-[11vh]"
      >
        {/* One column holds both the back link and the form so their left edges line up. It is anchored to the
            top (not centred) so the form doesn't jump when validation messages appear. */}
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand-700 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
