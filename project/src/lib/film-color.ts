/**
 * The interface has no accent colour of its own. It borrows the hue of whatever
 * title you are looking at.
 *
 * A poster is sampled in the browser, its dominant hue is extracted weighted by
 * saturation, and that hue is re-rendered as *light*: same hue, forced
 * saturation and lightness. So the colour on screen is never a brand decision,
 * it is a property of the artwork, and the whole app changes temperature as you
 * browse.
 *
 * The maths is pure and unit-tested. Only `extractFilmColor` touches the DOM,
 * and every failure path returns null, which leaves the UI in its neutral state.
 */

export interface FilmColor {
  /** Dominant hue of the artwork, 0-359. */
  hue: number;
  /** The hue as light: what an active control or a cast glow uses. */
  light: string;
  /** The same hue, deep: for fills that sit under white text. */
  deep: string;
  /** The same hue, near-black: for the veil that lifts a hero from the page. */
  veil: string;
}

/* -------------------------------- colour maths ------------------------------- */

/** sRGB 0-255 to HSL with h in 0-359 and s/l in 0-1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

/** HSL back to a `#rrggbb` string. */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Pixels too grey, too dark or blown out say nothing about a film's colour: a
// black letterbox bar and a white logo are present on almost every poster.
const MIN_SATURATION = 0.3;
const MIN_LIGHTNESS = 0.12;
const MAX_LIGHTNESS = 0.88;
// 12-degree buckets: fine enough to separate a red from an orange, coarse enough
// that a gradient sky still lands in one bucket instead of scattering.
const HUE_BUCKET = 12;

/**
 * Dominant hue of raw RGBA pixels, or null when nothing is colourful enough.
 *
 * Buckets are weighted by squared saturation, so a small vivid area beats a
 * large muted one. Without that, most posters resolve to the same washed
 * blue-grey their background happens to be.
 */
export function dominantHue(pixels: Uint8ClampedArray, channels = 4): number | null {
  const weights = new Map<number, number>();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;
    const bucket = Math.round(h / HUE_BUCKET) * HUE_BUCKET;
    weights.set(bucket, (weights.get(bucket) ?? 0) + s * s);
  }
  if (weights.size === 0) return null;
  let best = 0;
  let bestWeight = -1;
  for (const [bucket, w] of weights) {
    if (w > bestWeight) {
      bestWeight = w;
      best = bucket;
    }
  }
  return best % 360;
}

/**
 * Render a hue as the three roles the interface needs. Saturation and lightness
 * are fixed on purpose: a dark poster and a bright one must produce equally
 * usable light, otherwise half the catalogue would light the room with mud.
 */
export function lightFrom(hue: number): FilmColor {
  return {
    hue: ((hue % 360) + 360) % 360,
    light: hslToHex(hue, 0.88, 0.6),
    deep: hslToHex(hue, 0.85, 0.32),
    veil: hslToHex(hue, 0.8, 0.13),
  };
}

/* ------------------------------- extraction -------------------------------- */

// Same host pattern as lib/img.ts: only TMDB URLs can be down-sized this way.
const TMDB_IMG_RE = /^(https?:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/.+)$/;

/**
 * The cheapest TMDB variant, used only for sampling. `w92` is a few kilobytes
 * and TMDB serves it with a one-year cache, so the second visit costs nothing.
 * A non-TMDB URL is sampled as-is.
 */
export function sampleUrl(url: string): string {
  const match = url.match(TMDB_IMG_RE);
  return match ? `${match[1]}w92${match[2]}` : url;
}

const cache = new Map<string, FilmColor | null>();
const inFlight = new Map<string, Promise<FilmColor | null>>();

/**
 * Sample a poster and resolve its colour, or null when it cannot be read.
 *
 * `crossOrigin` is load-bearing: without it the canvas is tainted and
 * `getImageData` throws. TMDB answers with `access-control-allow-origin: *`,
 * which is what makes the whole approach possible without a backend.
 */
export function extractFilmColor(url: string | null | undefined): Promise<FilmColor | null> {
  if (!url || typeof document === 'undefined') return Promise.resolve(null);
  const key = sampleUrl(url);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = new Promise<FilmColor | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const w = 48;
        const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w)) || 72;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const hue = dominantHue(ctx.getImageData(0, 0, w, h).data);
        resolve(hue == null ? null : lightFrom(hue));
      } catch {
        // Tainted canvas, or a browser refusing getImageData in a private mode.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = key;
  }).then((result) => {
    cache.set(key, result);
    inFlight.delete(key);
    return result;
  });

  inFlight.set(key, task);
  return task;
}

/** Test seam: drops the memo so a suite can re-run extraction deterministically. */
export function clearFilmColorCache(): void {
  cache.clear();
  inFlight.clear();
}
