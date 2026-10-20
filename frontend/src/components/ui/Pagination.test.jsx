import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination, pageWindow } from "./Pagination.jsx";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long ranges around the current page", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
  });
});

describe("Pagination", () => {
  const setup = (props) => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} count={47} pageSize={10} onPageChange={onPageChange} {...props} />);
    return onPageChange;
  };

  it("reports the visible range", () => {
    setup();
    expect(screen.getByText(/showing/i).textContent).toBe("Showing 11–20 of 47");
  });

  it("marks the current page and navigates", async () => {
    const onPageChange = setup();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("button", { name: "Page 4" }));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([4, 3, 1]);
  });

  it("disables Previous on the first page and Next on the last", () => {
    setup({ page: 1 });
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("hides the page buttons when everything fits on one page", () => {
    setup({ page: 1, totalPages: 1, count: 4 });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/showing/i).textContent).toBe("Showing 1–4 of 4");
  });

  it("renders nothing for an empty result", () => {
    const { container } = render(<Pagination page={1} totalPages={1} count={0} pageSize={10} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
