import { useEffect, useRef, useState } from "react";
import { FilterX, Search } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { FilterSelect } from "../ui/FormFields.jsx";
import { CATEGORIES, SEVERITIES, SORT_OPTIONS, STATUSES } from "../../utils/constants.js";

export const EMPTY_FILTERS = { search: "", status: "", category: "", severity: "", sort: "", unresolved: "" };

export const hasActiveFilters = (filters) =>
  Boolean(filters.search || filters.status || filters.category || filters.severity || filters.unresolved);

/**
 * Search + filter controls. A single row above the results, scoping everything below it.
 * The search box updates the results shortly after typing stops.
 */
export function RequestFilters({ filters, onChange, searchLabel = "Search requests", searchPlaceholder }) {
  const timer = useRef(null);

  // A search that is still waiting for typing to pause must not fire after the user has
  // left the page (e.g. typed, then clicked a result): it would navigate them straight back.
  useEffect(() => () => clearTimeout(timer.current), []);

  const [text, setText] = useState(filters.search);
  const [seenSearch, setSeenSearch] = useState(filters.search);

  // If the URL changes from outside (back button, "clear filters"), reflect it in the box.
  if (filters.search !== seenSearch) {
    setSeenSearch(filters.search);
    if (filters.search !== text.trim()) setText(filters.search);
  }

  function handleSearchInput(event) {
    const value = event.target.value;
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ search: value.trim() }), 350);
  }

  function submitSearchNow(event) {
    event.preventDefault();
    clearTimeout(timer.current);
    onChange({ search: text.trim() });
  }

  function clearAll() {
    clearTimeout(timer.current);
    setText("");
    onChange({ ...EMPTY_FILTERS, sort: filters.sort });
  }

  return (
    <form role="search" onSubmit={submitSearchNow} className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <label htmlFor="request-search" className="sr-only">
          {searchLabel}
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          id="request-search"
          type="search"
          value={text}
          onChange={handleSearchInput}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-field bg-white pl-9 pr-3 text-sm placeholder:text-ink-3 hover:border-ink-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:items-center">
        <FilterSelect
          label="Filter by status"
          placeholder="All statuses"
          value={filters.status}
          onChange={(status) => onChange({ status, unresolved: "" })}
          options={STATUSES}
          className="lg:w-40"
        />
        <FilterSelect
          label="Filter by category"
          placeholder="All categories"
          value={filters.category}
          onChange={(category) => onChange({ category })}
          options={CATEGORIES}
          className="lg:w-44"
        />
        <FilterSelect
          label="Filter by severity"
          placeholder="Any severity"
          value={filters.severity}
          onChange={(severity) => onChange({ severity })}
          options={SEVERITIES}
          className="lg:w-36"
        />
        <FilterSelect
          label="Sort results"
          placeholder="Newest first"
          value={filters.sort}
          onChange={(sort) => onChange({ sort })}
          options={SORT_OPTIONS.filter((option) => option.value !== "newest")}
          className="lg:w-48"
        />
      </div>

      {hasActiveFilters(filters) && (
        <Button type="button" variant="ghost" size="sm" icon={FilterX} onClick={clearAll} className="self-start lg:self-auto">
          Clear filters
        </Button>
      )}
    </form>
  );
}
