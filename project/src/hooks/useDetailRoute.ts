import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { track } from '../lib/analytics';
import type { MediaType } from '../lib/types';

const WATCH = 'watch';
const PERSON = 'person';

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

  let target: { id: number; mediaType: MediaType } | null = null;
  if (raw) {
    const [mediaType, idStr] = raw.split('-');
    const id = Number(idStr);
    if ((mediaType === 'movie' || mediaType === 'tv') && Number.isInteger(id) && id > 0) {
      target = { mediaType, id };
    }
  }

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
