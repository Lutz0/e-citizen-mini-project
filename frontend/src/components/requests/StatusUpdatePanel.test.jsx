import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client.js";
import { ToastProvider } from "../../context/ToastContext.jsx";
import { StatusUpdatePanel } from "./StatusUpdatePanel.jsx";

vi.mock("../../api/requests.js", () => ({ changeStatus: vi.fn() }));
import { changeStatus } from "../../api/requests.js";

const pending = {
  reference: "SR-2026-AAAAAA",
  status: "pending",
  allowed_next_statuses: [{ value: "in_progress", label: "In Progress" }],
};

function renderPanel(request = pending) {
  const onUpdated = vi.fn();
  render(
    <ToastProvider>
      <StatusUpdatePanel request={request} onUpdated={onUpdated} />
    </ToastProvider>,
  );
  return onUpdated;
}

beforeEach(() => {
  changeStatus.mockReset();
});

describe("StatusUpdatePanel", () => {
  it("offers only the single legal next step", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /mark in progress/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolved/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation before changing anything", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /mark in progress/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Mark as In Progress?" })).toBeInTheDocument();
    expect(within(dialog).getByText(/can't be undone/i)).toBeInTheDocument();
    expect(changeStatus).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it("sends the new status and the optional note, then refreshes", async () => {
    changeStatus.mockResolvedValue({ status: "in_progress" });
    const onUpdated = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /mark in progress/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/note to the citizen/i), "Crew booked for Tuesday");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as In Progress" }));

    expect(changeStatus).toHaveBeenCalledWith("SR-2026-AAAAAA", { status: "in_progress", note: "Crew booked for Tuesday" });
    expect(await screen.findByText(/is now In Progress/i)).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalled();
  });

  it("explains a server-side rejection and keeps the dialog open", async () => {
    changeStatus.mockRejectedValue(
      new ApiError({
        status: 400,
        code: "validation_error",
        detail: "Please correct the highlighted fields.",
        errors: { status: ["Cannot move a request from In Progress to In Progress."] },
      }),
    );
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /mark in progress/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mark as In Progress" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/cannot move a request/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows resolved requests as final, with no actions", () => {
    renderPanel({ reference: "SR-2026-BBBBBB", status: "resolved", allowed_next_statuses: [] });
    expect(screen.getByText(/this request is resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
