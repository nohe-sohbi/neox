import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { track } from '../lib/analytics';
import { entryKey as keyOf, toggleEntry, upsertEntry } from '../lib/library-utils';
import type { LibraryEntry, LibraryStatus, MediaItem } from '../lib/types';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'neox.library.v1';

type ItemRef = Pick<MediaItem, 'id' | 'mediaType'>;

function readLocal(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

interface LibraryContextValue {
  entries: LibraryEntry[];
  count: number;
  syncing: boolean;
  get: (item: ItemRef) => LibraryEntry | undefined;
  isSaved: (item: ItemRef) => boolean;
  statusOf: (item: ItemRef) => LibraryStatus | null;
  ratingOf: (item: ItemRef) => number | null;
  toggle: (item: MediaItem) => boolean;
  setStatus: (item: MediaItem, status: LibraryStatus) => void;
  setRating: (item: MediaItem, rating: number | null) => void;
  remove: (item: ItemRef) => void;
  clear: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LibraryEntry[]>(readLocal);
  const [syncing, setSyncing] = useState(false);

  const prevUserId = useRef<string | null>(null);
  const putTimer = useRef<ReturnType<typeof setTimeout>>();

  const persistLocal = (next: LibraryEntry[]) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const schedulePush = useCallback(
    (next: LibraryEntry[]) => {
      if (!user) return;
      clearTimeout(putTimer.current);
      putTimer.current = setTimeout(() => {
        api.putLibrary(next).catch(() => {
          /* offline-tolerant: local copy stays authoritative */
        });
      }, 800);
    },
    [user],
  );

  const apply = useCallback(
    (updater: (prev: LibraryEntry[]) => LibraryEntry[]) => {
      setEntries((prev) => {
        const next = updater(prev);
        persistLocal(next);
        schedulePush(next);
        return next;
      });
    },
    [schedulePush],
  );

  // On login (or user switch), merge the local library into the account.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid && uid !== prevUserId.current) {
      setSyncing(true);
      api
        .mergeLibrary(readLocal())
        .then((res) => {
          setEntries(res.entries);
          persistLocal(res.entries);
        })
        .catch(() => {
          /* keep local on failure */
        })
        .finally(() => setSyncing(false));
    }
    prevUserId.current = uid;
  }, [user]);

  const get = useCallback(
    (item: ItemRef) => entries.find((e) => keyOf(e) === keyOf(item)),
    [entries],
  );

  const isSaved = useCallback((item: ItemRef) => Boolean(get(item)), [get]);
  const statusOf = useCallback((item: ItemRef) => get(item)?.status ?? null, [get]);
  const ratingOf = useCallback((item: ItemRef) => get(item)?.personalRating ?? null, [get]);

  const toggle = useCallback(
    (item: MediaItem) => {
      const exists = entries.some((e) => keyOf(e) === keyOf(item));
      apply((prev) => toggleEntry(prev, item));
      if (!exists) track('Library Add', { mediaType: item.mediaType });
      return !exists;
    },
    [entries, apply],
  );

  const upsert = useCallback(
    (item: MediaItem, patch: Partial<LibraryEntry>) => {
      apply((prev) => upsertEntry(prev, item, patch));
    },
    [apply],
  );

  const setStatus = useCallback(
    (item: MediaItem, status: LibraryStatus) => upsert(item, { status }),
    [upsert],
  );

  const setRating = useCallback(
    (item: MediaItem, rating: number | null) =>
      // Rating something implies you've watched it.
      upsert(item, { personalRating: rating, status: 'watched' }),
    [upsert],
  );

  const remove = useCallback(
    (item: ItemRef) => apply((prev) => prev.filter((e) => keyOf(e) !== keyOf(item))),
    [apply],
  );

  const clear = useCallback(() => apply(() => []), [apply]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      entries,
      count: entries.length,
      syncing,
      get,
      isSaved,
      statusOf,
      ratingOf,
      toggle,
      setStatus,
      setRating,
      remove,
      clear,
    }),
    [
      entries,
      syncing,
      get,
      isSaved,
      statusOf,
      ratingOf,
      toggle,
      setStatus,
      setRating,
      remove,
      clear,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
