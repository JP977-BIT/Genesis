// Generic client-side cached-promise factory for per-company data.
//
// Module-level state survives client-side navigations (same JS bundle), so a
// prefetch fired on company-select is still warm when Finance mounts later.
// Storing the PROMISE (not the resolved value) means a consumer that mounts
// while the fetch is still in flight awaits the same request instead of
// duplicating it.

interface Entry<T> {
  promise: Promise<T | null>;
  fetchedAt: number;
}

// 5 minutes — matches useTranTotals.STALE_MS and the server routes' 300s
// unstable_cache, so client and server staleness stay in step.
const DEFAULT_STALE_MS = 5 * 60 * 1000;

export function createClientCache<T>(
  fetcher: (companyNr: string) => Promise<T | null>,
  staleMs: number = DEFAULT_STALE_MS,
) {
  const cache = new Map<string, Entry<T>>();

  function get(companyNr: string, force = false): Promise<T | null> {
    const entry = cache.get(companyNr);
    if (!force && entry && Date.now() - entry.fetchedAt < staleMs) {
      return entry.promise;
    }

    const promise = fetcher(companyNr)
      .catch(() => null)
      .then((data) => {
        // A failed fetch must not poison the cache for 5 minutes — evict so
        // the consumer's own retry path fetches fresh. Guard against a newer
        // entry (e.g. a forced refresh) having replaced this one meanwhile.
        if (data === null && cache.get(companyNr)?.promise === promise) {
          cache.delete(companyNr);
        }
        return data;
      });

    cache.set(companyNr, { promise, fetchedAt: Date.now() });
    return promise;
  }

  return {
    get,
    prefetch: (companyNr: string): void => {
      void get(companyNr);
    },
  };
}
