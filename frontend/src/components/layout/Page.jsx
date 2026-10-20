import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

/** Standard page width + gutters. */
export function Container({ children, className = "", narrow = false }) {
  return (
    <div className={`mx-auto w-full ${narrow ? "max-w-2xl" : "max-w-6xl"} px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

/** Title block at the top of a page: optional back link, h1, description and action buttons. */
export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
