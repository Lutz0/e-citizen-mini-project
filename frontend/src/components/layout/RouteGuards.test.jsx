import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestOnly, RequireAuth } from "./RouteGuards.jsx";

vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: vi.fn() }));
import { useAuth } from "../../context/AuthContext.jsx";

const citizen = { id: 1, role: "citizen", full_name: "Amina Hassan" };
const admin = { id: 2, role: "admin", full_name: "Grace Wanjiku" };

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>landing</p>} />
        <Route path="/login" element={<GuestOnly><p>login page</p></GuestOnly>} />
        <Route path="/requests" element={<RequireAuth role="citizen"><p>citizen area</p></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth role="admin"><p>admin area</p></RequireAuth>} />
        <Route path="/requests/:reference" element={<RequireAuth><p>request detail</p></RequireAuth>} />
      </Routes>
    </MemoryRouter>,
  );
}

const signedInAs = (user) => useAuth.mockReturnValue({ user, ready: true });

describe("RequireAuth", () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it("shows a loader while the session is being checked", () => {
    useAuth.mockReturnValue({ user: null, ready: false });
    renderAt("/admin");
    expect(screen.getByText(/checking your session/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("sends anonymous visitors to the login page", () => {
    signedInAs(null);
    renderAt("/requests");
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("citizen area")).not.toBeInTheDocument();
  });

  it("protects the administrator area from citizens", () => {
    signedInAs(citizen);
    renderAt("/admin");
    expect(screen.getByRole("heading", { name: /don't have access/i })).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
  });

  it("lets administrators in", () => {
    signedInAs(admin);
    renderAt("/admin");
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });

  it("lets citizens into their own area", () => {
    signedInAs(citizen);
    renderAt("/requests");
    expect(screen.getByText("citizen area")).toBeInTheDocument();
  });

  it("redirects an administrator away from citizen-only pages", () => {
    signedInAs(admin);
    renderAt("/requests");
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });

  it("allows any signed-in user on role-neutral routes", () => {
    signedInAs(citizen);
    renderAt("/requests/SR-2026-ABCDEF");
    expect(screen.getByText("request detail")).toBeInTheDocument();
  });
});

describe("GuestOnly", () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it("shows the login page to anonymous visitors", () => {
    signedInAs(null);
    renderAt("/login");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("sends signed-in people to their own home", () => {
    signedInAs(admin);
    renderAt("/login");
    expect(screen.getByText("admin area")).toBeInTheDocument();
  });
});
