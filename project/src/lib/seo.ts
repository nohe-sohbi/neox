/**
 * SEO / social-preview metadata, applied to the live document.
 *
 * The *served* head now comes from the route manifest: the build prerenders one
 * shell per route (`routes.ts` + `scripts/seo-prerender.ts`), so a crawler that
 * never runs JS already gets the right title, description and canonical. This
 * module keeps that head correct once the app is running:
 *
 *   - the browser tab + bookmarks show the title of the page or title you're on,
 *   - unfurlers and crawlers that run JS read accurate Open Graph / Twitter tags
 *     for the *current* route or open title,
 *   - deep links (`/?watch=movie-550`) carry their own title, description and
 *     poster image instead of the generic site default.
 *
 * Views take their input from `routeMeta()` so what React applies is what the
 * build already wrote: the document never contradicts the shell it came from.
 *
 * `buildMeta` is a pure function (no DOM) so it is trivially unit-testable; the
 * DOM application lives in `applyMeta` and is only ever called from a hook in
 * the browser.
 */
import { OG_IMAGE_PATH, PLACEHOLDER_ORIGIN, SITE_NAME } from './routes';

export { SITE_NAME };

/** Absolute site origin, used for canonical + og:url. Configurable per deploy. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || PLACEHOLDER_ORIGIN).replace(/\/+$/, '');

export const DEFAULT_TITLE = 'NEOX · Ton radar cinéma & séries';
export const DEFAULT_DESCRIPTION =
  'Découvre les films et séries du moment, regarde les bandes-annonces et trouve instantanément où les voir en streaming légal. Crée ta watchlist en un clic.';
// 1200x630 PNG: the unfurlers (Facebook, X, LinkedIn, Slack) do not render SVG,
// so an SVG og:image means every share has no preview at all.
export const DEFAULT_IMAGE = `${SITE_URL}${OG_IMAGE_PATH}`;

const MAX_DESCRIPTION = 200;

export interface MetaInput {
  /** Page/entity title, without the brand suffix (added automatically). */
  title?: string;
  description?: string;
  image?: string | null;
  /** Alternative text for `image`, so a shared card is not a mute rectangle. */
  imageAlt?: string | null;
  /** Open Graph object type, e.g. "website", "video.movie", "profile". */
  type?: string;
  /** Path (+ optional query) of the current view, for canonical / og:url. */
  path?: string;
  /**
   * `robots` directive for views with no search value (per-user surfaces, search
   * result pages). Left undefined the tag is removed, which is the indexable
   * default; robots.txt is deliberately not used for these, since a disallowed
   * URL is never crawled and its noindex therefore never read.
   */
  robots?: string;
}

export interface ResolvedMeta {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  type: string;
  url: string;
  robots?: string;
}

/** Collapse whitespace and clip to `max`, appending an ellipsis when clipped. */
export function truncate(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Site-level fallbacks for title/description, overridable per call (e.g. to
 * localize them from the active UI language). */
export interface MetaDefaults {
  title?: string;
  description?: string;
  imageAlt?: string;
}

/** Resolve a partial meta input into a complete, defaulted set of tags. */
export function buildMeta(input: MetaInput = {}, defaults: MetaDefaults = {}): ResolvedMeta {
  const rawTitle = input.title?.trim();
  const title = rawTitle ? `${rawTitle} · ${SITE_NAME}` : defaults.title || DEFAULT_TITLE;

  const rawDescription = input.description?.trim();
  const description = truncate(rawDescription || defaults.description || DEFAULT_DESCRIPTION);

  const rawImage = input.image?.trim();
  const image = rawImage || DEFAULT_IMAGE;
  // An alt describing the default card would be a lie over a poster, so the
  // fallback only applies while the default image is the one being shared.
  const imageAlt =
    input.imageAlt?.trim() || (rawImage ? title : defaults.imageAlt || DEFAULT_TITLE);
  const type = input.type?.trim() || 'website';

  let url = SITE_URL;
  if (input.path) {
    url = `${SITE_URL}${input.path.startsWith('/') ? '' : '/'}${input.path}`;
  }

  return {
    title,
    description,
    image,
    imageAlt,
    type,
    url,
    robots: input.robots?.trim() || undefined,
  };
}

/* ----------------------------- DOM application ---------------------------- */

// The full set of head tags this module owns. Snapshotting/restoring exactly
// these keeps modal overlays from permanently clobbering the page's own meta.
const META_TAGS: { attr: 'name' | 'property'; key: string; from: keyof ResolvedMeta }[] = [
  { attr: 'name', key: 'description', from: 'description' },
  { attr: 'property', key: 'og:title', from: 'title' },
  { attr: 'property', key: 'og:description', from: 'description' },
  { attr: 'property', key: 'og:image', from: 'image' },
  { attr: 'property', key: 'og:image:alt', from: 'imageAlt' },
  { attr: 'property', key: 'og:type', from: 'type' },
  { attr: 'property', key: 'og:url', from: 'url' },
  { attr: 'name', key: 'twitter:card', from: 'image' /* overridden below */ },
  { attr: 'name', key: 'twitter:title', from: 'title' },
  { attr: 'name', key: 'twitter:description', from: 'description' },
  { attr: 'name', key: 'twitter:image', from: 'image' },
  { attr: 'name', key: 'twitter:image:alt', from: 'imageAlt' },
];

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function upsertOrRemoveRobots(value: string | undefined): void {
  const el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!value) {
    el?.remove();
    return;
  }
  if (el) el.setAttribute('content', value);
  else upsertMeta('name', 'robots', value);
}

export interface MetaSnapshot {
  title: string;
  tags: Record<string, string | null>;
  canonical: string | null;
  robots: string | null;
}

/** Capture the currently-applied head state so it can be restored later. */
export function snapshotMeta(): MetaSnapshot {
  const tags: Record<string, string | null> = {};
  for (const { attr, key } of META_TAGS) {
    const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    tags[`${attr}:${key}`] = el ? el.getAttribute('content') : null;
  }
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  return {
    title: document.title,
    tags,
    canonical: canonical ? canonical.getAttribute('href') : null,
    robots: robots ? robots.getAttribute('content') : null,
  };
}

/** Apply a resolved meta set to the document head. */
export function applyMeta(meta: ResolvedMeta): void {
  document.title = meta.title;
  for (const { attr, key, from } of META_TAGS) {
    const content = key === 'twitter:card' ? 'summary_large_image' : meta[from];
    upsertMeta(attr, key, content);
  }
  upsertCanonical(meta.url);
  upsertOrRemoveRobots(meta.robots);
}

/** Restore a previously captured snapshot (used when an overlay closes). */
export function restoreMeta(snapshot: MetaSnapshot): void {
  document.title = snapshot.title;
  for (const { attr, key } of META_TAGS) {
    const content = snapshot.tags[`${attr}:${key}`];
    if (content != null) upsertMeta(attr, key, content);
  }
  if (snapshot.canonical != null) upsertCanonical(snapshot.canonical);
  upsertOrRemoveRobots(snapshot.robots ?? undefined);
}
