import { useEffect, useState } from 'react';
import { extractFilmColor, type FilmColor } from '../lib/film-color';

/**
 * The colour a title lends to the interface, or null while it is unknown.
 *
 * Null is a first-class state, not an error: the neutral interface is the
 * default, and colour is what arrives afterwards. Anything reading this must
 * look correct without it, which is also what happens for a title with no
 * artwork at all.
 */
export function useFilmColor(posterUrl: string | null | undefined): FilmColor | null {
  const [color, setColor] = useState<FilmColor | null>(null);

  useEffect(() => {
    if (!posterUrl) {
      setColor(null);
      return;
    }
    let cancelled = false;
    void extractFilmColor(posterUrl).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [posterUrl]);

  return color;
}
