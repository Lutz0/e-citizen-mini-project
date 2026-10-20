/**
 * Thin fetch wrapper for the Django API.
 *
 * - Authentication is a first-party session cookie (HttpOnly - JavaScript never
 *   sees it, so an XSS bug cannot steal the session).
 * - Unsafe requests echo Django's CSRF cookie in the X-CSRFToken header.
 * - Every failure is normalised into an ApiError the UI can render directly.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor({ status, code, detail, errors }) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    /** Field errors from the server: { field: ["message", ...] } */
    this.errors = errors || {};
  }

  /** First error message for a field, or "". */
  fieldError(field) {
    return this.errors[field]?.[0] || "";
  }
}

const NETWORK_MESSAGE = "We couldn't reach the server. Please check your connection and try again.";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let unauthorizedHandler = null;
/** Called when a request that *should* be authenticated comes back 401 (e.g. session expired). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function getCookie(name) {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export async function ensureCsrfCookie() {
  if (getCookie("csrftoken")) return;
  await fetch(`${API_BASE}/auth/csrf/`, { credentials: "include" });
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} path  e.g. "/requests/"
 * @param {{method?: string, params?: object, json?: object, formData?: FormData,
 *          signal?: AbortSignal, expectAuth?: boolean}} options
 *   expectAuth=false marks calls (login, session probe) where a 401 is a normal
 *   outcome and must not trigger the "session expired" handler.
 */
export async function request(path, { method = "GET", params, json, formData, signal, expectAuth = true } = {}) {
  const headers = { Accept: "application/json" };
  const init = { method, headers, credentials: "include", signal };

  if (!SAFE_METHODS.has(method)) {
    try {
      await ensureCsrfCookie();
    } catch {
      throw new ApiError({ status: 0, code: "network_error", detail: NETWORK_MESSAGE });
    }
    headers["X-CSRFToken"] = getCookie("csrftoken");
  }
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (formData) {
    init.body = formData; // the browser sets the multipart boundary
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, init);
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError({ status: 0, code: "network_error", detail: NETWORK_MESSAGE });
  }

  const data = await parseBody(response);
  if (response.ok) return data;

  const error = new ApiError({
    status: response.status,
    code: data?.code || "error",
    detail:
      data?.detail ||
      (response.status >= 500
        ? "Something went wrong on our side. Please try again in a moment."
        : "The request could not be completed."),
    errors: data?.errors,
  });
  if (response.status === 401 && expectAuth && unauthorizedHandler) unauthorizedHandler(error);
  throw error;
}
