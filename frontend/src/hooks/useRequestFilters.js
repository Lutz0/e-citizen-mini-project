import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

export const PAGE_SIZE = 10;
const FILTER_KEYS = ["search", "status", "category", "severity", "sort", "unresolved"];

/**
 * Filters, sorting and page live in the URL query string, so a filtered view can
 * be bookmarked, shared, refreshed and navigated with the back button.
 */
export function useRequestFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || ""])),
    [searchParams],
  );
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);

  /** Merge changes into the query string. Any filter change returns to page 1. */
  const update = useCallback(
    (changes, { replace = false } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });
          if (!("page" in changes)) next.delete("page");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback((nextPage) => update({ page: nextPage > 1 ? String(nextPage) : "" }), [update]);

  /** Parameters for the API call (empty values omitted by the client). */
  const apiParams = useMemo(
    () => ({
      ...filters,
      sort: filters.sort || undefined,
      unresolved: filters.unresolved ? "true" : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [filters, page],
  );

  return { filters, page, update, setPage, apiParams };
}
