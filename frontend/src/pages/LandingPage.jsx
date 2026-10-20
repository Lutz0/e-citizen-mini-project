import { ArrowRight, Bell, Camera, ClipboardList, History, Lock, MapPin, Search } from "lucide-react";
import { StatusBadge } from "../components/ui/Badges.jsx";
import { ButtonLink } from "../components/ui/Button.jsx";
import { Container } from "../components/layout/Page.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { CATEGORIES, homePathFor, STATUSES } from "../utils/constants.js";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Report the issue",
    text: "Choose a category, say where the problem is and describe it. Add a photo if you have one.",
  },
  {
    icon: Search,
    title: "Track every step",
    text: "You get a reference number straight away. Follow your request from Pending to In Progress to Resolved.",
  },
  {
    icon: Bell,
    title: "Hear back from the team",
    text: "We email you whenever the status changes, and the service team can leave updates on your request.",
  },
];

const PROMISES = [
  { icon: History, title: "Every change is recorded", text: "Each status update is logged with who made it and when, so progress is transparent." },
  { icon: Lock, title: "Your reports stay yours", text: "Only you and the service team can see your requests and photos." },
  { icon: Camera, title: "Photos stay private", text: "Location data is stripped from uploaded images before they are stored." },
];

function SampleRequestCard() {
  return (
    <figure className="rounded-2xl border border-line bg-white p-5 shadow-pop" aria-label="Example of a request">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Example request</figcaption>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-brand-700">SR-2026-K7M3Q9</p>
          <p className="mt-1 font-semibold text-ink">Streetlights</p>
        </div>
        <StatusBadge status="in_progress" />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
        <MapPin className="size-4 shrink-0" aria-hidden="true" /> Moi Avenue, near the pharmacy
      </p>
      <p className="mt-2 text-sm text-ink-2">The lamp post has been flickering for a week and the road is dark at night.</p>
      <ol className="mt-4 space-y-2 border-t border-line pt-4 text-sm" aria-label="Progress">
        {[
          ["Submitted", "Mon, 09:12", true],
          ["Work started", "Tue, 14:40", true],
          ["Resolved", "Waiting", false],
        ].map(([label, time, done]) => (
          <li key={label} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`size-3 rounded-full border-2 ${done ? "border-resolved-700 bg-resolved-700" : "border-line-strong bg-white"}`}
            />
            <span className={done ? "font-medium text-ink" : "text-ink-3"}>{label}</span>
            <span className="ml-auto text-ink-3">{time}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export default function LandingPage() {
  useDocumentTitle("");
  const { user, isAdmin } = useAuth();

  const primaryCta = !user
    ? { to: "/register", label: "Report an issue" }
    : isAdmin
      ? { to: "/admin", label: "Open the dashboard" }
      : { to: "/requests/new", label: "Report an issue" };

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-page">
        <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">
              <span className="size-2 rounded-full bg-resolved-700" aria-hidden="true" />
              Community service requests
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-5xl sm:leading-[1.1]">
              Report a problem in your community. Follow it until it's fixed.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              A broken streetlight, no water, overflowing bins, a damaged road or a blocked drain — tell the service team in
              minutes and see exactly where your request stands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to={primaryCta.to} size="lg" icon={ArrowRight}>
                {primaryCta.label}
              </ButtonLink>
              {user ? (
                !isAdmin && (
                  <ButtonLink to={homePathFor(user)} size="lg" variant="secondary">
                    My requests
                  </ButtonLink>
                )
              ) : (
                <ButtonLink to="/login" size="lg" variant="secondary">
                  Sign in
                </ButtonLink>
              )}
            </div>
          </div>
          <SampleRequestCard />
        </Container>
      </section>

      {/* Categories */}
      <section className="bg-white py-12 sm:py-16" aria-labelledby="categories-heading">
        <Container>
          <h2 id="categories-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            What you can report
          </h2>
          <p className="mt-2 max-w-2xl text-ink-2">Pick the category that fits best — or "Other" for anything else.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map(({ value, label, icon: Icon, example }) => (
              <li key={value} className="flex items-start gap-4 rounded-xl border border-line p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{label}</h3>
                  <p className="text-sm text-ink-2">{example}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-4 py-12 sm:py-16" aria-labelledby="how-heading">
        <Container>
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="rounded-xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                    {index + 1}
                  </span>
                  <Icon className="size-6 text-brand-700" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-ink-2">{text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-xl border border-line bg-white p-6 shadow-card">
            <h3 className="text-lg font-semibold">What the statuses mean</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              {STATUSES.map(({ value, description }) => (
                <div key={value} className="flex flex-col items-start gap-2">
                  <dt>
                    <StatusBadge status={value} />
                  </dt>
                  <dd className="text-sm text-ink-2">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* Trust */}
      <section className="bg-white py-12 sm:py-16" aria-labelledby="trust-heading">
        <Container>
          <h2 id="trust-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Accountable and private
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-1 size-6 shrink-0 text-brand-700" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Closing call to action */}
      <section className="on-dark bg-brand-900 py-12 text-white">
        <Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">See something that needs fixing?</h2>
            <p className="mt-1 text-brand-100">It takes about two minutes to file a request.</p>
          </div>
          <ButtonLink to={primaryCta.to} size="lg" variant="on-dark" icon={ArrowRight}>
            {primaryCta.label}
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}
