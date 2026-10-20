import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, RequestFilters } from "./RequestFilters.jsx";

afterEach(() => vi.useRealTimers());

describe("RequestFilters search box", () => {
  it("waits for typing to pause, then searches once with the trimmed text", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<RequestFilters filters={EMPTY_FILTERS} onChange={onChange} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  pot" } });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  pothole  " } });
    act(() => vi.advanceTimersByTime(349));
    expect(onChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(2));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ search: "pothole" });
  });

  it("never fires a pending search after the page has been left", () => {
    // Regression: type a search, click a result straight away, and the late timer used to
    // navigate the user back to the list they had just left.
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { unmount } = render(<RequestFilters filters={EMPTY_FILTERS} onChange={onChange} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pothole" } });
    unmount();
    act(() => vi.advanceTimersByTime(1000));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("searches immediately when Enter is pressed", async () => {
    const onChange = vi.fn();
    render(<RequestFilters filters={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.type(screen.getByRole("searchbox"), "drain{Enter}");
    expect(onChange).toHaveBeenCalledWith({ search: "drain" });
  });

  it("reflects a search that changes from outside (e.g. the back button)", () => {
    const { rerender } = render(<RequestFilters filters={{ ...EMPTY_FILTERS, search: "first" }} onChange={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("first");
    rerender(<RequestFilters filters={{ ...EMPTY_FILTERS, search: "second" }} onChange={() => {}} />);
    expect(screen.getByRole("searchbox")).toHaveValue("second");
  });
});

describe("RequestFilters selects and clearing", () => {
  it("applies a status filter and drops the 'unresolved' shortcut", async () => {
    const onChange = vi.fn();
    render(<RequestFilters filters={{ ...EMPTY_FILTERS, unresolved: "true" }} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "resolved");
    expect(onChange).toHaveBeenCalledWith({ status: "resolved", unresolved: "" });
  });

  it("offers 'Clear filters' only when something is filtered, and resets everything but the sort order", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RequestFilters filters={EMPTY_FILTERS} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(
      <RequestFilters filters={{ ...EMPTY_FILTERS, search: "x", category: "water", sort: "severity" }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, sort: "severity" });
  });
});
