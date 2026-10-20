import { useRef } from "react";
import { Outlet } from "react-router";
import { useFocusMainOnNavigate } from "../../hooks/useFocusMainOnNavigate.js";
import { Footer } from "./Footer.jsx";
import { Header } from "./Header.jsx";

export function AppShell() {
  const mainRef = useRef(null);
  useFocusMainOnNavigate(mainRef);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
