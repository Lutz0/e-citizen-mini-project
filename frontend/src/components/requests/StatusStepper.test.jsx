import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusStepper } from "./StatusStepper.jsx";

const base = {
  created_at: "2026-10-12T08:00:00Z",
  in_progress_at: null,
  resolved_at: null,
};

const stepStates = () =>
  within(screen.getByRole("list", { name: /request progress/i }))
    .getAllByRole("listitem")
    .map((item) => item.textContent.match(/\((completed|current stage|not reached yet)\)/)[1]);

describe("StatusStepper", () => {
  it("marks Pending as the current stage for a new request", () => {
    render(<StatusStepper request={{ ...base, status: "pending" }} />);
    expect(stepStates()).toEqual(["current stage", "not reached yet", "not reached yet"]);
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("shows Pending as done once work has started, with both timestamps", () => {
    render(<StatusStepper request={{ ...base, status: "in_progress", in_progress_at: "2026-10-13T09:30:00Z" }} />);
    expect(stepStates()).toEqual(["completed", "current stage", "not reached yet"]);
    expect(screen.getByText("Work started")).toBeInTheDocument();
  });

  it("shows every stage completed when resolved, and no 'current' step", () => {
    const request = { ...base, status: "resolved", in_progress_at: "2026-10-13T09:30:00Z", resolved_at: "2026-10-14T16:00:00Z" };
    const { container } = render(<StatusStepper request={request} />);
    expect(stepStates()).toEqual(["completed", "completed", "completed"]);
    expect(container.querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.getByText("Issue fixed")).toBeInTheDocument();
  });
});
