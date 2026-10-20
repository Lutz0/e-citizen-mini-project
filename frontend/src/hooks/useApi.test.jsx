import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApi } from "./useApi.js";

/** A promise we can settle by hand, to observe the in-between states. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useApi", () => {
  it("loads data, reporting loading until the first result", async () => {
    const fetcher = vi.fn().mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => useApi(fetcher, "a"));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("keeps the previous data on screen while a new key loads", async () => {
    const second = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce("first").mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ id }) => useApi(fetcher, id), { initialProps: { id: 1 } });
    await waitFor(() => expect(result.current.data).toBe("first"));

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.data).toBe("first"); // still showing the old results
    expect(result.current.loading).toBe(false);

    await act(async () => second.resolve("second"));
    expect(result.current.data).toBe("second");
    expect(result.current.refreshing).toBe(false);
  });

  it("surfaces errors and can retry with reload()", async () => {
    const failure = { status: 500, detail: "Boom" };
    const fetcher = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce("ok");
    const { result } = renderHook(() => useApi(fetcher, "k"));

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.loading).toBe(false);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale response that arrives after the key changed", async () => {
    const slow = deferred();
    const fetcher = vi.fn((signal) => (signal.aborted ? Promise.reject() : null));
    fetcher.mockReturnValueOnce(slow.promise).mockResolvedValueOnce("fresh");
    const { result, rerender } = renderHook(({ id }) => useApi(fetcher, id), { initialProps: { id: 1 } });

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe("fresh"));

    await act(async () => slow.resolve("stale"));
    expect(result.current.data).toBe("fresh");
  });

  it("does nothing while disabled", () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useApi(fetcher, "x", { enabled: false }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
