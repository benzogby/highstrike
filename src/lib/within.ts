/**
 * At most `ms` of waiting for an outside feed (Ben, 2026-11-02: "lightning fast"): a slow or unreachable feed gives the
 * fallback instead of holding the page (Finnhub has taken 10 s to time out). The request itself carries on, so a cached
 * fetch still fills the cache for the next visit.
 */
export function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
