/**
 * JSON-LD structured data (schema.org).
 *
 * The head tags in `seo.ts` tell a crawler how to *display* a link. Structured
 * data tells it what the page *is*, which is what makes a title eligible for a
 * rich result rather than a plain blue link.
 *
 * Every builder is pure and returns a plain object, so the shape is unit-tested
 * without a DOM. Only fields NEOX actually has are emitted: an incomplete
 * property is worse than an absent one, because Google reports it as invalid.
 */
import type { CastMember, MediaDetails, Person } from './types';
import { SITE_NAME, SITE_URL, truncate } from './seo';

export type JsonLd = Record<string, unknown>;

/** Drop null/undefined/empty entries so no property is emitted half-filled. */
function compact(obj: JsonLd): JsonLd {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }),
  );
}

/** ISO 8601 duration, the only format schema.org accepts for `duration`. */
export function isoDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}` || null;
}

/**
 * Site-level graph for the home page: identifies the site and declares the
 * search endpoint, which is what a sitelinks searchbox is built from.
 */
export function buildWebSite(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildCast(cast: CastMember[], max = 8): JsonLd[] {
  return cast.slice(0, max).map((c) => compact({ '@type': 'Person', name: c.name }));
}

/**
 * `Movie` or `TVSeries` for an open title. `aggregateRating` is only emitted
 * when there is a real vote count behind it: Google rejects a rating with no
 * `ratingCount`, and a fabricated one is a manual-action risk.
 */
export function buildMediaSchema(details: MediaDetails, canonicalUrl: string): JsonLd {
  const isSeries = details.mediaType === 'tv';
  const rating =
    details.rating != null && details.voteCount > 0
      ? compact({
          '@type': 'AggregateRating',
          ratingValue: Number(details.rating.toFixed(1)),
          ratingCount: details.voteCount,
          bestRating: 10,
          worstRating: 0,
        })
      : null;

  return compact({
    '@context': 'https://schema.org',
    '@type': isSeries ? 'TVSeries' : 'Movie',
    name: details.title,
    alternateName: details.originalTitle !== details.title ? details.originalTitle : null,
    url: canonicalUrl,
    image: details.poster,
    description: details.overview ? truncate(details.overview, 300) : null,
    genre: details.genres,
    datePublished: details.releaseDate || null,
    duration: isSeries ? null : isoDuration(details.runtime),
    numberOfSeasons: isSeries ? details.numberOfSeasons : null,
    numberOfEpisodes: isSeries ? details.numberOfEpisodes : null,
    actor: buildCast(details.cast),
    aggregateRating: rating,
    trailer: details.trailerKey
      ? {
          '@type': 'VideoObject',
          name: `Bande-annonce : ${details.title}`,
          embedUrl: `https://www.youtube.com/embed/${details.trailerKey}`,
        }
      : null,
  });
}

/** `Person` for an open cast member. */
export function buildPersonSchema(person: Person, canonicalUrl: string): JsonLd {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url: canonicalUrl,
    image: person.photo,
    description: person.biography ? truncate(person.biography, 300) : null,
    birthDate: person.birthday,
    birthPlace: person.placeOfBirth
      ? { '@type': 'Place', name: person.placeOfBirth }
      : null,
  });
}

/* ----------------------------- DOM application ---------------------------- */

const SCRIPT_ID = 'neox-jsonld';

/**
 * Write (or remove) the single JSON-LD block this module owns. One block, one
 * id: overlays replace it on open and the underlying view puts its own back on
 * close, so a crawler never sees two competing descriptions of the same URL.
 */
export function applyJsonLd(data: JsonLd | null): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(SCRIPT_ID);
  if (!data) {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement('script');
  if (!existing) {
    script.id = SCRIPT_ID;
    (script as HTMLScriptElement).type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/** Read back the current block, so an overlay can restore what it replaced. */
export function snapshotJsonLd(): string | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(SCRIPT_ID)?.textContent ?? null;
}

export function restoreJsonLd(snapshot: string | null): void {
  if (typeof document === 'undefined') return;
  if (snapshot == null) {
    document.getElementById(SCRIPT_ID)?.remove();
    return;
  }
  applyJsonLd(JSON.parse(snapshot) as JsonLd);
}
