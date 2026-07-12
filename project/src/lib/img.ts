/**
 * Responsive image helpers for TMDB artwork.
 *
 * The API hands the client a single fixed-size TMDB URL (e.g. a `w500` poster).
 * TMDB serves any size from the same path by swapping the width token, so we can
 * derive a `srcset` client-side and let the browser pick the right resolution
 * for the viewport + DPR — cutting bandwidth on phones (a poster grid rendered
 * at ~150px wide has no business downloading a 500px-wide image) and improving
 * LCP, all without changing the API contract.
 *
 * The width variants are always <= the size the API already requested, so we
 * never upscale beyond what the backend deemed the canonical size.
 */
import type { MediaItem } from './types';

export interface ResponsiveImg {
  src: string;
  srcSet?: string;
  sizes?: string;
}

// Captures the size token segment right after "/t/p/" (e.g. w500, original,
// h632) so it can be swapped for a width variant. Only TMDB image hosts match;
// anything else is passed through untouched.
const TMDB_IMG_RE = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/.+)$/;

function build(url: string, widths: number[], sizes: string): ResponsiveImg {
  const match = url.match(TMDB_IMG_RE);
  if (!match) return { src: url };
  const [, prefix, tail] = match;
  const srcSet = widths.map((w) => `${prefix}w${w}${tail} ${w}w`).join(', ');
  // The largest variant is the plain-`src` fallback for browsers that ignore
  // srcset, keeping behaviour identical to the previous fixed URL.
  const src = `${prefix}w${widths[widths.length - 1]}${tail}`;
  return { src, srcSet, sizes };
}

// Poster grids: ~2 columns on phones, up to a fixed card width on desktop.
const POSTER_SIZES = '(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw';

/** Poster artwork (2:3). API serves w500. */
export function posterImg(url: string, sizes: string = POSTER_SIZES): ResponsiveImg {
  return build(url, [185, 342, 500], sizes);
}

/** Full-bleed backdrop artwork. API serves w1280. */
export function backdropImg(url: string, sizes = '100vw'): ResponsiveImg {
  return build(url, [780, 1280], sizes);
}

/** Episode still (16:9). API serves w300. */
export function stillImg(url: string, sizes = '(min-width: 640px) 160px, 40vw'): ResponsiveImg {
  return build(url, [185, 300], sizes);
}

/** Convenience: responsive poster for a media item, or null when it has none. */
export function itemPoster(item: Pick<MediaItem, 'poster'>, sizes?: string): ResponsiveImg | null {
  return item.poster ? posterImg(item.poster, sizes) : null;
}
