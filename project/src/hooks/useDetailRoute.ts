import { useCallback, useMemo, type MouseEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../lib/analytics';
import type { MediaType } from '../lib/types';

const WATCH = 'watch';
const PERSON = 'person';

/**
 * True when a click on a link must be left to the browser: a middle click, or
 * ctrl/cmd/shift/alt, all of which mean "open this somewhere else". Overlays
 * are opened by intercepting a plain left click, and intercepting these too
 * would break the one thing an href buys a user over a button.
 */
export function isModifiedClick(e: MouseEvent): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** Encodes a media item into a shareable `?watch=movie-550` deep link. */
export function useOpenDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (item: { id: number; mediaType: MediaType }) => {
      const params = new URLSearchParams(location.search);
      params.set(WATCH, `${item.mediaType}-${item.id}`);
      params.delete(PERSON);
      navigate({ pathname: location.pathname, search: params.toString() });
      track('Open Detail', { mediaType: item.mediaType });
    },
    [navigate, location.pathname, location.search],
  );
}

/** Opens an actor/crew page via `?person=ID`. */
export function useOpenPerson() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (id: number) => {
      const params = new URLSearchParams(location.search);
      params.set(PERSON, String(id));
      navigate({ pathname: location.pathname, search: params.toString() });
    },
    [navigate, location.pathname, location.search],
  );
}

/** Reads/clears the currently-open detail target from the URL. */
export function useDetailTarget() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(WATCH);

  // Memoized on the raw deep-link string so `target` keeps a stable reference
  // across renders. DetailModal puts it in an effect's deps (it reloads when the
  // target changes); a fresh object literal every render would re-fire that
  // effect on every commit and loop the fetch.
  const target = useMemo<{ id: number; mediaType: MediaType } | null>(() => {
    if (!raw) return null;
    const [mediaType, idStr] = raw.split('-');
    const id = Number(idStr);
    if ((mediaType === 'movie' || mediaType === 'tv') && Number.isInteger(id) && id > 0) {
      return { mediaType, id };
    }
    return null;
  }, [raw]);

  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete(WATCH);
    setParams(next, { replace: true });
  }, [params, setParams]);

  return { target, close };
}

/** Reads/clears the currently-open person from the URL. */
export function usePersonTarget() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PERSON);
  const id = raw ? Number(raw) : NaN;
  const personId = Number.isInteger(id) && id > 0 ? id : null;

  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete(PERSON);
    setParams(next, { replace: true });
  }, [params, setParams]);

  return { personId, close };
}
