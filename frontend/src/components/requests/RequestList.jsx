import { Link } from "react-router";
import { Camera, MapPin } from "lucide-react";
import { CategoryLabel, SeverityBadge, StatusBadge } from "../ui/Badges.jsx";
import { formatDate, formatRelative, truncate } from "../../utils/format.js";

/**
 * Requests as a table on wide screens and as cards on phones.
 * The reference number is the single real link in each row; a stretched
 * pseudo-element makes the whole row/card clickable without nesting links.
 */
export function RequestList({ requests, showCitizen = false }) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Service requests</caption>
          <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-ink-2">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Reference</th>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Location</th>
              {showCitizen && <th scope="col" className="px-4 py-3 font-semibold">Citizen</th>}
              <th scope="col" className="px-4 py-3 font-semibold">Severity</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.map((request) => (
              <tr key={request.reference} className="relative align-top hover:bg-brand-50/60">
                <td className="px-4 py-3.5">
                  <Link
                    to={`/requests/${request.reference}`}
                    className="font-mono text-[13px] font-semibold text-brand-700 hover:underline after:absolute after:inset-0 after:content-['']"
                  >
                    {request.reference}
                  </Link>
                  {request.has_image && (
                    <span className="ml-2 inline-flex align-middle text-ink-3" title="Has a photo">
                      <Camera className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Has a photo</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <CategoryLabel category={request.category} />
                </td>
                <td className="max-w-64 px-4 py-3.5 text-ink">
                  <span className="line-clamp-2">{request.location}</span>
                </td>
                {showCitizen && (
                  <td className="px-4 py-3.5">
                    <span className="block font-medium text-ink">{request.citizen.full_name}</span>
                    <span className="block text-xs text-ink-3">{request.citizen.email}</span>
                  </td>
                )}
                <td className="px-4 py-3.5">
                  <SeverityBadge severity={request.severity} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={request.status} />
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-ink-2">
                  <span className="block">{formatDate(request.created_at)}</span>
                  <span className="block text-xs text-ink-3">{formatRelative(request.created_at)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {requests.map((request) => (
          <li key={request.reference} className="relative p-4 hover:bg-brand-50/60">
            <div className="flex items-start justify-between gap-3">
              <CategoryLabel category={request.category} className="font-semibold" />
              <StatusBadge status={request.status} />
            </div>
            <Link
              to={`/requests/${request.reference}`}
              className="mt-2 inline-block font-mono text-[13px] font-semibold text-brand-700 after:absolute after:inset-0 after:content-['']"
            >
              {request.reference}
            </Link>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
              {request.location}
            </p>
            <p className="mt-1 text-sm text-ink-2">{truncate(request.description, 90)}</p>
            {showCitizen && <p className="mt-1 text-xs text-ink-3">Reported by {request.citizen.full_name}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <SeverityBadge severity={request.severity} />
              <span className="text-xs text-ink-3">Submitted {formatDate(request.created_at)}</span>
              {request.has_image && (
                <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                  <Camera className="size-3.5" aria-hidden="true" /> Photo
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Placeholder rows shown the first time a list loads. */
export function RequestListSkeleton({ rows = 5 }) {
  return (
    <div role="status" aria-label="Loading requests" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 p-4" aria-hidden="true">
          <div className="h-4 w-28 rounded bg-line" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
          <div className="hidden h-4 w-28 rounded bg-line md:block" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
          <div className="h-4 flex-1 rounded bg-line" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
          <div className="h-6 w-20 rounded-full bg-line" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
        </div>
      ))}
      <span className="sr-only">Loading requests…</span>
    </div>
  );
}
