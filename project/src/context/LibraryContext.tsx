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
import { ApiError, api, type LibrarySync } from '../lib/api';
import { track } from '../lib/analytics';
import { entryKey as keyOf, toggleEntry, upsertEntry } from '../lib/library-utils';
import { mergeEntries } from '../lib/library-io';
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
  importEntries: (incoming: LibraryEntry[]) => number;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LibraryEntry[]>(readLocal);
  const [syncing, setSyncing] = useState(false);

  const prevUserId = useRef<string | null>(null);
  const putTimer = useRef<ReturnType<typeof setTimeout>>();
  /** Revision this device last saw; `undefined` until the first sync answers. */
  const rev = useRef<number | undefined>(undefined);

  const persistLocal = (next: LibraryEntry[]) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  /**
   * Pushes the library against the revision we last saw.
   *
   * A full-replacement PUT is a data-loss weapon between two open sessions: the
   * slower one would erase what the other just saved. So the server refuses a
   * stale write and hands back its own state; we union it into ours (most
   * recently updated entry wins, same rule as the login merge) and push once
   * more. Removals are the known limit of a tombstone-free model: an entry
   * deleted here while another device still has it comes back. Losing a deletion
   * beats losing a collection.
   */
  const pushLibrary = useCallback(async (next: LibraryEntry[]) => {
    try {
      rev.current = (await api.putLibrary(next, rev.current)).rev;
      return;
    } catch (err) {
      const conflict = err instanceof ApiError && err.code === 'LIBRARY_CONFLICT'
        ? (err.details as LibrarySync | undefined)
        : undefined;
      if (!conflict || !Array.isArray(conflict.entries)) {
        /* offline or server-side trouble: the local copy stays authoritative */
        return;
      }
      const merged = mergeEntries(next, conflict.entries);
      rev.current = conflict.rev;
      setEntries(merged);
      persistLocal(merged);
      try {
        rev.current = (await api.putLibrary(merged, rev.current)).rev;
      } catch {
        /* a second conflict in the same second: the next change carries the
           union up, and the login merge is the backstop */
      }
    }
  }, []);

  const schedulePush = useCallback(
    (next: LibraryEntry[]) => {
      if (!user) return;
      clearTimeout(putTimer.current);
      putTimer.current = setTimeout(() => void pushLibrary(next), 800);
    },
    [user, pushLibrary],
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
  // On logout, drop the (account's) library from this device so the next user
  // starts clean; otherwise the merge-on-login effect would push the previous
  // user's watchlist into a different account.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid && uid !== prevUserId.current) {
      setSyncing(true);
      api
        .mergeLibrary(readLocal())
        .then((res) => {
          rev.current = res.rev;
          setEntries(res.entries);
          persistLocal(res.entries);
        })
        .catch(() => {
          /* keep local on failure */
        })
        .finally(() => setSyncing(false));
    } else if (!uid && prevUserId.current) {
      // Logout: cancel any pending push and reset local state + storage. The
      // list is safe on the account and comes back via merge on the next login.
      clearTimeout(putTimer.current);
      rev.current = undefined;
      setEntries([]);
      persistLocal([]);
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
    (item: MediaItem, rating: number | null) => {
      // Rating something implies you've watched it.
      upsert(item, { personalRating: rating, status: 'watched' });
      if (rating != null) track('Rating Set', { rating });
    },
    [upsert],
  );

  const remove = useCallback(
    (item: ItemRef) => apply((prev) => prev.filter((e) => keyOf(e) !== keyOf(item))),
    [apply],
  );

  const clear = useCallback(() => apply(() => []), [apply]);

  // Merge a restored/imported backup into the current library. Returns how many
  // entries the collection grew by, so the UI can report the result.
  const importEntries = useCallback(
    (incoming: LibraryEntry[]) => {
      let added = 0;
      apply((prev) => {
        const merged = mergeEntries(prev, incoming);
        added = merged.length - prev.length;
        return merged;
      });
      track('Library Import', { count: incoming.length });
      return added;
    },
    [apply],
  );

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
      importEntries,
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
      importEntries,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
