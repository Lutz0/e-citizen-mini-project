import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryLabel, SeverityBadge, StatusBadge } from "./Badges.jsx";

describe("StatusBadge", () => {
  it.each([
    ["pending", "Pending"],
    ["in_progress", "In Progress"],
    ["resolved", "Resolved"],
  ])("shows %s as readable text", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("pairs the text with an icon so colour is never the only signal", () => {
    const { container } = render(<StatusBadge status="resolved" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("falls back gracefully for an unknown status", () => {
    render(<StatusBadge status="mystery" />);
    expect(screen.getByText("mystery")).toBeInTheDocument();
  });
});

describe("SeverityBadge", () => {
  it("announces the word 'Severity' to screen readers", () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText(/severity:/i)).toHaveClass("sr-only");
    expect(screen.getByText("High")).toBeInTheDocument();
  });
});

describe("CategoryLabel", () => {
  it("shows the friendly name for a category", () => {
    render(<CategoryLabel category="water" />);
    expect(screen.getByText("Water supply")).toBeInTheDocument();
  });
});
