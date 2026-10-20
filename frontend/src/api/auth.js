import { request } from "./client.js";

/**
 * Who is signed in? Returns the user, or null for an anonymous visitor.
 * Uses the session probe, which always answers 200 (no 401 noise in the console)
 * and sets the CSRF cookie the next POST will need.
 */
export async function fetchCurrentUser(signal) {
  const { user } = await request("/auth/session/", { signal, expectAuth: false });
  return user;
}

export const login = ({ email, password }) =>
  request("/auth/login/", { method: "POST", json: { email, password }, expectAuth: false });

export const register = (values) =>
  request("/auth/register/", { method: "POST", json: values, expectAuth: false });

export const logout = () => request("/auth/logout/", { method: "POST", expectAuth: false });
