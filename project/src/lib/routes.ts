/**
 * The route manifest: one description of every URL NEOX serves.
 *
 * A client-rendered SPA ships a single HTML shell, so out of the box the head a
 * crawler reads is always the home page's — same `<title>`, same canonical, on
 * every URL. That is not a cosmetic problem: `/movies` and `/tv` are in the
 * sitemap while declaring themselves duplicates of `/`, which is an instruction
 * not to index them.
 *
 * This module is the single source of truth that fixes it. The build reads it to
 * prerender one shell per route (`scripts/seo-prerender.ts`) and to generate the
 * sitemap; the views read it so the head React applies after hydration is the
 * same one the server already sent. Nothing here is duplicated in a template.
 *
 * Deliberately free of `import.meta.env`, the DOM and every browser-only API:
 * it is imported by the Vite config, which runs in Node.
 */
import { createTranslator, type Lang } from './i18n/core';

export const SITE_NAME = 'NEOX';

/**
 * Origin baked into the built files. The real one is only known at deploy time,
 * so the build ships this placeholder and `scripts/rewrite-site-urls.mjs` swaps
 * it for `VITE_SITE_URL` afterwards.
 */
export const PLACEHOLDER_ORIGIN = 'https://neox.app';

/** 1200x630 social card, the one file the unfurlers read. */
export const OG_IMAGE_PATH = '/og-image.png';

export type JsonLd = Record<string, unknown>;

export type RouteId = 'home' | 'movies' | 'tv' | 'search' | 'library' | 'notFound';

export interface SiteRoute {
  id: RouteId;
  /** Path the SPA router answers on. */
  path: string;
  /** File the build emits for it; nginx serves `/movies` from `movies.html`. */
  file: string;
  /** Title key, without the brand suffix. Absent = the site-level default. */
  titleKey?: string;
  /** Description key. Absent = the site-level default. */
  descriptionKey?: string;
  /**
   * `robots` directive. Absent means indexable, which is the default. These are
   * served in the HTML rather than disallowed in robots.txt on purpose: a URL
   * closed to crawling never has its `noindex` read.
   */
  robots?: string;
  /** False on shells that answer for more than one URL, which cannot claim one. */
  canonical?: boolean;
  /** Absent when the route has no place in the sitemap. */
  sitemap?: { changefreq: string; priority: string };
}

export const SITE_ROUTES: readonly SiteRoute[] = [
  {
    id: 'home',
    path: '/',
    file: 'index.html',
    descriptionKey: 'seo.default_description',
    sitemap: { changefreq: 'daily', priority: '1.0' },
  },
  {
    id: 'movies',
    path: '/movies',
    file: 'movies.html',
    titleKey: 'discover.movies_title',
    descriptionKey: 'discover.movies_sub',
    sitemap: { changefreq: 'daily', priority: '0.8' },
  },
  {
    id: 'tv',
    path: '/tv',
    file: 'tv.html',
    titleKey: 'discover.tv_title',
    descriptionKey: 'discover.tv_sub',
    sitemap: { changefreq: 'daily', priority: '0.8' },
  },
  {
    id: 'search',
    path: '/search',
    file: 'search.html',
    titleKey: 'search.title',
    descriptionKey: 'search.empty_desc',
    // Thin, duplicated and infinite. Crawlable so the directive is read,
    // `follow` so the titles it links to are still discovered.
    robots: 'noindex, follow',
  },
  {
    id: 'library',
    path: '/library',
    file: 'library.html',
    titleKey: 'library.title',
    descriptionKey: 'library.subtitle_empty',
    // Per-user surface: nothing here is the same page twice.
    robots: 'noindex, nofollow',
  },
  {
    id: 'notFound',
    path: '/404',
    file: '404.html',
    titleKey: 'notfound.title',
    descriptionKey: 'notfound.desc',
    robots: 'noindex, follow',
    // Answers for every unknown URL, so it can never name a canonical.
    canonical: false,
  },
];

const BY_ID = new Map(SITE_ROUTES.map((r) => [r.id, r]));

export function routeById(id: RouteId): SiteRoute {
  const route = BY_ID.get(id);
  if (!route) throw new Error(`Unknown route id "${id}".`);
  return route;
}

/* ------------------------------- Deep links -------------------------------- */

/**
 * Canonical URL of a title's overlay. Titles have no route of their own: they
 * open over whatever page you are on, and `?watch=` can therefore ride any
 * path. Everything that *links* to a title uses this form — always rooted at
 * `/` — so a crawler is only ever offered the one address the overlay declares
 * canonical, instead of `/movies?watch=…` and `/tv?watch=…` for the same film.
 */
export function detailPath(mediaType: string, id: number): string {
  return `/?watch=${mediaType}-${id}`;
}

/** Same, for a cast or crew member's overlay. */
export function personPath(id: number): string {
  return `/?person=${id}`;
}

/* ------------------------------ Per-route meta ----------------------------- */

/**
 * Structurally a `MetaInput` (see `seo.ts`), declared here so this module stays
 * importable from the build without dragging in `import.meta.env`.
 */
export interface RouteMeta {
  title?: string;
  description?: string;
  path?: string;
  canonical?: boolean;
  robots?: string;
}

/**
 * The head a view applies after hydration. Reading it from the manifest is what
 * keeps the live document identical to the shell the crawler was served.
 */
export function routeMeta(id: RouteId, lang: Lang): RouteMeta {
  const route = routeById(id);
  const t = createTranslator(lang);
  return {
    title: route.titleKey ? t(route.titleKey) : undefined,
    description: route.descriptionKey ? t(route.descriptionKey) : undefined,
    path: route.canonical === false ? undefined : route.path,
    // Explicit, not merely absent: without a path the resolver falls back to
    // the site root, which would have the 404 shell declare every dead URL a
    // duplicate of the home page — the soft 404 it exists to avoid.
    canonical: route.canonical,
    robots: route.robots,
  };
}

/* ------------------------------ Structured data ---------------------------- */

/**
 * Site-level identity: what the site is, plus the search endpoint a sitelinks
 * searchbox is built from.
 */
export function buildWebSiteLd(origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${origin}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * The publisher behind the site. No `logo`: NEOX has no raster mark of its own,
 * and Google does not accept the SVG icon — an absent property beats a wrong one.
 */
export function buildOrganizationLd(origin: string, lang: Lang): JsonLd {
  const t = createTranslator(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${origin}/`,
    description: t('seo.default_description'),
  };
}

/**
 * Both site-level entities in the one block the app owns. `@graph` rather than
 * two scripts: the client can only ever swap a single block when an overlay
 * opens, so the home page has to fit in one.
 */
export function buildHomeGraphLd(origin: string, lang: Lang): JsonLd {
  // One `@context`, on the graph itself: repeating it on each node is legal but
  // noise, and Google reads the outer one for every member.
  const strip = (node: JsonLd): JsonLd => {
    const rest: JsonLd = { ...node };
    delete rest['@context'];
    return rest;
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [strip(buildWebSiteLd(origin)), strip(buildOrganizationLd(origin, lang))],
  };
}

/* --------------------------------- Sitemap --------------------------------- */

/**
 * Sitemap over the canonical URLs, generated from the manifest so a renamed or
 * added route can never leave a stale entry behind.
 *
 * No `lastmod`: the only date the build knows is its own, and stamping it on
 * pages whose catalogue changes daily would understate freshness the moment a
 * deploy stops shipping. `changefreq` says the true thing instead.
 */
export function buildSitemapXml(origin: string): string {
  const entries = SITE_ROUTES.filter((r) => r.sitemap).map((route) => {
    const loc = `${origin}${route.path === '/' ? '/' : route.path}`;
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>${route.sitemap!.changefreq}</changefreq>`,
      `    <priority>${route.sitemap!.priority}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!--',
    "  Generated at build time from the route manifest (src/lib/routes.ts).",
    '  Title and person deep links are client-rendered and effectively infinite,',
    '  so they are left out; /search and /library are served noindex and have no',
    '  place here either. What remains are the durable entry points worth crawling.',
    '-->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/* ------------------------------ HTML rendering ----------------------------- */

/** Escape a value destined for a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape a value destined for HTML text content. */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXml(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * `</script>` inside a JSON string would close the block early and spill the
 * rest of the payload into the document, so the `<` is escaped at the JSON level.
 */
function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** BCP-47 tag in the underscored form Open Graph expects (`fr_FR`). */
const OG_LOCALE: Record<Lang, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
};

export function ogLocale(lang: Lang): string {
  return OG_LOCALE[lang];
}

/** Full document title: the page name, then the brand. */
export function fullTitle(pageTitle: string | undefined, lang: Lang): string {
  const t = createTranslator(lang);
  const trimmed = pageTitle?.trim();
  return trimmed ? `${trimmed} · ${SITE_NAME}` : t('seo.default_title');
}

/**
 * The `<head>` block the build writes into every prerendered shell: title,
 * description, robots, canonical, Open Graph, Twitter card and — on the home
 * page — the site-level structured data. Indented to sit inside `<head>`.
 */
export function renderSeoHead(route: SiteRoute, origin: string, lang: Lang): string {
  const meta = routeMeta(route.id, lang);
  const t = createTranslator(lang);
  const title = fullTitle(meta.title, lang);
  const description = meta.description || t('seo.default_description');
  const image = `${origin}${OG_IMAGE_PATH}`;
  const url = meta.path ? `${origin}${meta.path === '/' ? '/' : meta.path}` : null;

  const lines: string[] = [`<title>${escapeText(title)}</title>`];

  const metaTag = (attr: 'name' | 'property', key: string, content: string) =>
    `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`;

  lines.push(metaTag('name', 'description', description));
  if (meta.robots) lines.push(metaTag('name', 'robots', meta.robots));
  if (url) lines.push(`<link rel="canonical" href="${escapeAttr(url)}" />`);

  lines.push(metaTag('property', 'og:site_name', SITE_NAME));
  lines.push(metaTag('property', 'og:title', title));
  lines.push(metaTag('property', 'og:description', description));
  lines.push(metaTag('property', 'og:type', 'website'));
  lines.push(metaTag('property', 'og:locale', ogLocale(lang)));
  if (url) lines.push(metaTag('property', 'og:url', url));
  lines.push(metaTag('property', 'og:image', image));
  lines.push(metaTag('property', 'og:image:width', '1200'));
  lines.push(metaTag('property', 'og:image:height', '630'));
  lines.push(metaTag('property', 'og:image:alt', t('seo.og_image_alt')));

  lines.push(metaTag('name', 'twitter:card', 'summary_large_image'));
  lines.push(metaTag('name', 'twitter:title', title));
  lines.push(metaTag('name', 'twitter:description', description));
  lines.push(metaTag('name', 'twitter:image', image));
  lines.push(metaTag('name', 'twitter:image:alt', t('seo.og_image_alt')));

  if (route.id === 'home') {
    lines.push(
      `<script type="application/ld+json">${serializeJsonLd(
        buildHomeGraphLd(origin, lang),
      )}</script>`,
    );
  }

  return `\n    ${lines.join('\n    ')}\n    `;
}

/**
 * What a visitor without JavaScript actually gets. Crawlers that do not run JS —
 * which today includes most answer engines — read exactly this, so it carries
 * the page's heading, its description and the links to the other sections
 * rather than an empty `<div id="root">`.
 */
export function renderNoscript(route: SiteRoute, lang: Lang): string {
  const t = createTranslator(lang);
  const meta = routeMeta(route.id, lang);
  const heading = route.id === 'home' ? t('home.heading') : meta.title || t('seo.default_title');
  const description = meta.description || t('seo.default_description');

  const links = SITE_ROUTES.filter((r) => r.sitemap && r.id !== route.id)
    .map((r) => {
      const label = r.titleKey ? t(r.titleKey) : t('nav.home');
      return `<a href="${escapeAttr(r.path)}">${escapeText(label)}</a>`;
    })
    .join(' · ');

  return [
    '',
    '      <noscript>',
    `        <h1>${escapeText(heading)}</h1>`,
    `        <p>${escapeText(description)}</p>`,
    `        <p>${escapeText(t('noscript.notice'))}</p>`,
    `        <nav aria-label="${escapeAttr(t('nav.primary'))}">${links}</nav>`,
    '      </noscript>',
    '    ',
  ].join('\n');
}
