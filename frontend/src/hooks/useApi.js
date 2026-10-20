import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load data and keep it fresh when the inputs change.
 *
 * `key` must be JSON-serialisable (filters, page, reference...). Whenever it
 * changes the request re-runs; the previous `data` stays available while the
 * new one loads, so the screen keeps its frame instead of flashing a skeleton.
 *
 *   const { data, error, loading, refreshing, reload } = useApi((signal) => listRequests(params, signal), params);
 *
 * - `loading`    true until the *first* result for the current key
 * - `refreshing` true while re-fetching with older data still on screen
 * - `error`      only set when the latest attempt for the current key failed
 */
export function useApi(fetcher, key, { enabled = true } = {}) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const requestKey = `${JSON.stringify(key ?? null)}#${reloadCount}`;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => {
        // A slow response for an old key must never overwrite the results of the current one.
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === "AbortError") return;
        setResult((previous) => ({ key: requestKey, data: previous.data, error }));
      });
    return () => controller.abort();
  }, [requestKey, enabled]);

  const settled = result.key === requestKey;
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    data: result.data,
    error: settled ? result.error : null,
    loading: enabled && !settled && result.data === null,
    refreshing: enabled && !settled && result.data !== null,
    reload,
  };
}
