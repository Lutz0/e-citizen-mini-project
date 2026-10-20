import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildQuery, request, setUnauthorizedHandler } from "./client.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const clearCookie = (name) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

let fetchMock;

beforeEach(() => {
  document.cookie = "csrftoken=token-123; path=/";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCookie("csrftoken");
});

describe("buildQuery", () => {
  it("omits empty values and encodes the rest", () => {
    expect(buildQuery({ a: "x y", b: "", c: undefined, d: null, e: 0 })).toBe("?a=x+y&e=0");
    expect(buildQuery({})).toBe("");
  });
});

describe("request", () => {
  it("sends credentials, no CSRF header for GET, and the query string", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await request("/requests/", { params: { status: "pending", search: "" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/requests/?status=pending");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRFToken"]).toBeUndefined();
  });

  it("echoes the CSRF cookie in X-CSRFToken on unsafe methods and sends JSON", async () => {
    fetchMock.mockResolvedValue(json({ id: 1 }, 201));
    await request("/auth/login/", { method: "POST", json: { email: "a@b.co" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-CSRFToken"]).toBe("token-123");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"email":"a@b.co"}');
  });

  it("fetches a CSRF cookie first when there isn't one yet", async () => {
    clearCookie("csrftoken");
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/auth/csrf/")) document.cookie = "csrftoken=fresh; path=/";
      return json({});
    });

    await request("/requests/", { method: "POST", json: {} });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/csrf/");
    expect(fetchMock.mock.calls[1][1].headers["X-CSRFToken"]).toBe("fresh");
  });

  it("lets the browser set the multipart boundary for FormData", async () => {
    fetchMock.mockResolvedValue(json({}, 201));
    await request("/requests/", { method: "POST", formData: new FormData() });
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  it("returns null for 204 responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(request("/auth/logout/", { method: "POST" })).resolves.toBeNull();
  });
});

describe("error handling", () => {
  it("turns validation failures into an ApiError with field messages", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: "Please correct the highlighted fields.", code: "validation_error", errors: { email: ["Taken."] } }, 400),
    );
    const error = await request("/auth/register/", { method: "POST", json: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.fieldError("email")).toBe("Taken.");
    expect(error.fieldError("other")).toBe("");
  });

  it("never exposes raw server output for 5xx errors", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Traceback (most recent call last)...</html>", { status: 500 }));
    const error = await request("/requests/").catch((e) => e);

    expect(error.status).toBe(500);
    expect(error.detail).toMatch(/something went wrong/i);
    expect(error.detail).not.toMatch(/traceback/i);
  });

  it("reports an unreachable server in plain language", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await request("/requests/").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("network_error");
    expect(error.detail).toMatch(/couldn't reach the server/i);
  });

  it("lets aborted requests through untouched", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const error = await request("/requests/").catch((e) => e);
    expect(error.name).toBe("AbortError");
  });

  it("calls the unauthorized handler on 401, unless the caller expects it", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockResolvedValue(json({ detail: "Not signed in.", code: "not_authenticated" }, 401));

    await request("/requests/").catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);

    await request("/auth/login/", { method: "POST", json: {}, expectAuth: false }).catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
