import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { MediaType } from '../lib/types';

const PARAM = 'watch';

/** Encodes a media item into a shareable `?watch=movie-550` deep link. */
export function useOpenDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (item: { id: number; mediaType: MediaType }) => {
      const params = new URLSearchParams(location.search);
      params.set(PARAM, `${item.mediaType}-${item.id}`);
      navigate({ pathname: location.pathname, search: params.toString() });
    },
    [navigate, location.pathname, location.search],
  );
}

/** Reads/clears the currently-open detail target from the URL. */
export function useDetailTarget() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PARAM);

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
    next.delete(PARAM);
    setParams(next, { replace: true });
  }, [params, setParams]);

  return { target, close };
}
