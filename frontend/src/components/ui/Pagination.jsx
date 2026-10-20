import { ChevronLeft, ChevronRight } from "lucide-react";

/** Up to 5 page numbers around the current page, with 1 and last pinned and gaps as "…". */
export function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((p, index) => (index > 0 && p - sorted[index - 1] > 1 ? ["gap", p] : [p]));
}

const NAV_BUTTON =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-semibold transition-colors";

export function Pagination({ page, totalPages, count, pageSize, onPageChange }) {
  if (!count) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-sm text-ink-2" aria-live="polite">
        Showing <span className="font-semibold text-ink">{first}–{last}</span> of{" "}
        <span className="font-semibold text-ink">{count}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`${NAV_BUTTON} border-line-strong bg-white hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Previous</span>
          </button>

          <span className="px-2 text-sm text-ink-2 sm:hidden">
            Page {page} of {totalPages}
          </span>
          <ul className="hidden items-center gap-1.5 sm:flex">
            {pageWindow(page, totalPages).map((item, index) =>
              item === "gap" ? (
                <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-3">
                  …
                </li>
              ) : (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => onPageChange(item)}
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    className={`${NAV_BUTTON} ${
                      item === page
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line-strong bg-white text-ink hover:bg-brand-50"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button
            type="button"
            className={`${NAV_BUTTON} border-line-strong bg-white hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <span className="sr-only sm:not-sr-only">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
