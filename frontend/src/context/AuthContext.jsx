import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authApi from "../api/auth.js";
import { setUnauthorizedHandler } from "../api/client.js";
import { ROLES } from "../utils/constants.js";
import { useToast } from "./ToastContext.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Who is signed in? (The session cookie is HttpOnly, so we ask the server.)
  useEffect(() => {
    const controller = new AbortController();
    authApi
      .fetchCurrentUser(controller.signal)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, []);

  // A 401 on a protected call while we think we're signed in means the session expired.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setUser(null);
        toast.info("Your session has expired. Please sign in again.");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  const login = useCallback(async (credentials) => {
    const signedIn = await authApi.login(credentials);
    setUser(signedIn);
    return signedIn;
  }, []);

  const register = useCallback(async (values) => {
    const created = await authApi.register(values);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null); // even if the network call fails, drop the local session
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === ROLES.ADMIN, login, register, logout }),
    [user, ready, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
