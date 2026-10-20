import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { ToastProvider } from "../context/ToastContext.jsx";
import LoginPage from "./LoginPage.jsx";

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
import { useAuth } from "../context/AuthContext.jsx";

const login = vi.fn();

function renderLogin() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/requests" element={<h1>My requests page</h1>} />
          <Route path="/admin" element={<h1>Admin page</h1>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  login.mockReset();
  useAuth.mockReturnValue({ login });
});

describe("LoginPage", () => {
  it("shows clear errors and does not call the API when the form is empty", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Please enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Please enter your password.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("Email address")).toHaveFocus());
  });

  it("rejects a malformed email before calling the API", async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "whatever1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs a citizen in and goes to their requests", async () => {
    login.mockResolvedValue({ role: "citizen", full_name: "Amina Hassan" });
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "  amina@example.test ");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "secret-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "My requests page" })).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ email: "amina@example.test", password: "secret-pass-1" });
  });

  it("sends an administrator to the dashboard", async () => {
    login.mockResolvedValue({ role: "admin", full_name: "Grace Wanjiku" });
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "admin@example.test");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "secret-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Admin page" })).toBeInTheDocument();
  });

  it("shows the server's generic message for wrong credentials", async () => {
    login.mockRejectedValue(
      new ApiError({
        status: 400,
        code: "validation_error",
        detail: "Invalid email or password.",
        errors: { non_field_errors: ["Invalid email or password."] },
      }),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "amina@example.test");
    await userEvent.type(screen.getByLabelText("Password", { exact: true }), "wrong-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const message = await screen.findByText("Invalid email or password.");
    expect(message.closest('[role="alert"]')).not.toBeNull(); // announced to screen readers
    expect(screen.queryByRole("heading", { name: "My requests page" })).not.toBeInTheDocument();
  });

  it("lets people reveal and hide the password", async () => {
    renderLogin();
    const field = screen.getByLabelText("Password", { exact: true });
    expect(field).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});
