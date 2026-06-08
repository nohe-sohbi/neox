import { useCallback, useEffect, useState } from 'react';
import type { MediaItem } from '../lib/types';

const STORAGE_KEY = 'neox.watchlist.v1';

function readStorage(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MediaItem[]) : [];
  } catch {
    return [];
  }
}

const keyOf = (item: Pick<MediaItem, 'id' | 'mediaType'>) => `${item.mediaType}:${item.id}`;

/**
 * Persistent watchlist backed by localStorage, synced across tabs and across
 * every component instance via a window event.
 */
export function useWatchlist() {
  const [items, setItems] = useState<MediaItem[]>(readStorage);

  useEffect(() => {
    const sync = () => setItems(readStorage());
    window.addEventListener('storage', sync);
    window.addEventListener('neox:watchlist', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('neox:watchlist', sync);
    };
  }, []);

  const persist = useCallback((next: MediaItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setItems(next);
    window.dispatchEvent(new Event('neox:watchlist'));
  }, []);

  const isSaved = useCallback(
    (item: Pick<MediaItem, 'id' | 'mediaType'>) =>
      items.some((i) => keyOf(i) === keyOf(item)),
    [items],
  );

  const toggle = useCallback(
    (item: MediaItem) => {
      const exists = items.some((i) => keyOf(i) === keyOf(item));
      const next = exists
        ? items.filter((i) => keyOf(i) !== keyOf(item))
        : [{ ...item }, ...items];
      persist(next);
      return !exists;
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { items, isSaved, toggle, clear, count: items.length };
}
