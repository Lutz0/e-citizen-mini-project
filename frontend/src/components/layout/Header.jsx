import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { LayoutDashboard, ListChecks, LogOut, Menu, Plus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Button, ButtonLink } from "../ui/Button.jsx";
import { Brand } from "./Brand.jsx";

const linkClass = ({ isActive }) =>
  `inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
    isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"
  }`;

export function Header() {
  const { user, isAdmin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      closeMenu();
      navigate("/");
      toast.success("You have been signed out.");
    } finally {
      setSigningOut(false);
    }
  }

  const navLinks = user ? (
    isAdmin ? (
      <NavLink to="/admin" className={linkClass} onClick={closeMenu}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        Dashboard
      </NavLink>
    ) : (
      <>
        <NavLink to="/requests" end className={linkClass} onClick={closeMenu}>
          <ListChecks className="size-4" aria-hidden="true" />
          My requests
        </NavLink>
        <NavLink to="/requests/new" className={linkClass} onClick={closeMenu}>
          <Plus className="size-4" aria-hidden="true" />
          New request
        </NavLink>
      </>
    )
  ) : (
    <NavLink to="/" end className={linkClass} onClick={closeMenu}>
      Home
    </NavLink>
  );

  const account = user ? (
    <>
      <div className="px-1 text-left lg:text-right">
        <p className="text-sm font-semibold leading-tight text-white">{user.full_name}</p>
        <p className="text-xs leading-tight text-brand-100">{isAdmin ? "Administrator" : "Citizen"}</p>
      </div>
      <Button variant="outline-on-dark" size="sm" icon={LogOut} onClick={handleLogout} loading={signingOut}>
        Sign out
      </Button>
    </>
  ) : (
    <>
      <ButtonLink to="/login" variant="outline-on-dark" size="sm" onClick={closeMenu}>
        Sign in
      </ButtonLink>
      <ButtonLink to="/register" variant="on-dark" size="sm" onClick={closeMenu}>
        Create account
      </ButtonLink>
    </>
  );

  return (
    <header className="on-dark bg-brand-900 text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Brand />

        {/* Desktop */}
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {navLinks}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">{account}</div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-white/15 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
            <nav aria-label="Main (mobile)" className="flex flex-col gap-1">
              {navLinks}
            </nav>
            <div className="flex flex-wrap items-center gap-3 border-t border-white/15 pt-4">{account}</div>
          </div>
        </div>
      )}
    </header>
  );
}
