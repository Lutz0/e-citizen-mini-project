import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

/**
 * After client-side navigation, reset scroll and move focus to the page so keyboard and
 * screen-reader users start at the top of the new content.
 * Comparing with the previous path (rather than a "first render" flag) keeps this from
 * firing on the initial load, even when React StrictMode re-runs effects.
 */
export function useFocusMainOnNavigate(mainRef) {
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef]);
}
