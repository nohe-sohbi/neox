import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TTL, isFresh, queryCache } from '../lib/query';

export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  /** Force a revalidation, bypassing the freshness check. */
  refetch: () => void;
}

export interface UseQueryOptions {
  /** Freshness window in ms. Cached data younger than this skips the network. */
  ttl?: number;
  /** When false, the query is idle (no fetch, no loading state). */
  enabled?: boolean;
}

/**
 * Stale-while-revalidate data hook backed by the shared {@link queryCache}.
 *
 * - Fresh cache hit  → paints immediately, no request, no spinner.
 * - Stale cache hit  → paints the stale value, revalidates in the background.
 * - Cache miss       → shows `loading`, fetches (deduped across components).
 *
 * On revalidation errors we keep showing the cached data; an error is only
 * surfaced when there is nothing to fall back on.
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const { ttl = DEFAULT_TTL, enabled = true } = options;

  const initial = queryCache.get<T>(key);
  const [data, setData] = useState<T | null>(initial ? initial.data : null);
  const [loading, setLoading] = useState<boolean>(enabled && !initial);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Keep the latest fetcher without making it a dependency (callers often pass
  // a fresh closure each render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const force = nonce > 0;
    const entry = queryCache.get<T>(key);

    if (entry) {
      setData(entry.data);
      setError(null);
      if (!force && isFresh(entry, ttl, Date.now())) {
        setLoading(false);
        return; // fresh enough — nothing to do
      }
      // stale (or forced): keep showing data, revalidate without a spinner
    } else {
      setData(null);
      setLoading(true);
    }

    queryCache
      .fetch(key, () => fetcherRef.current())
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Only surface the error if we have nothing cached to show.
        if (!queryCache.has(key)) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, ttl, enabled, nonce]);

  return { data, loading, error, refetch };
}
