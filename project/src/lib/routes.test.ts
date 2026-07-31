import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_ORIGIN,
  SITE_ROUTES,
  buildHomeGraphLd,
  buildSitemapXml,
  escapeAttr,
  fullTitle,
  renderNoscript,
  renderSeoHead,
  routeById,
  routeMeta,
} from './routes';

const ORIGIN = 'https://example.test';

/** Pull a tag's content out of a rendered head block. */
function content(head: string, attr: 'name' | 'property', key: string): string | null {
  const match = head.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)" />`));
  return match ? match[1] : null;
}

function canonical(head: string): string | null {
  const match = head.match(/<link rel="canonical" href="([^"]*)" \/>/);
  return match ? match[1] : null;
}

describe('the manifest', () => {
  it('gives every route a distinct path and a distinct file', () => {
    const paths = SITE_ROUTES.map((r) => r.path);
    const files = SITE_ROUTES.map((r) => r.file);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(files).size).toBe(files.length);
  });

  it('emits the home page as index.html so the shell stays the SPA fallback', () => {
    expect(routeById('home').file).toBe('index.html');
  });

  it('keeps every noindex route out of the sitemap', () => {
    for (const route of SITE_ROUTES) {
      if (route.robots?.includes('noindex')) expect(route.sitemap).toBeUndefined();
    }
  });
});

describe('routeMeta', () => {
  it('localizes the title and description from the route keys', () => {
    expect(routeMeta('movies', 'fr').title).toBe('Films');
    expect(routeMeta('movies', 'en').title).toBe('Movies');
    expect(routeMeta('tv', 'de').title).toBe('Serien');
  });

  it('carries the robots directive of the surfaces that must not be indexed', () => {
    expect(routeMeta('search', 'fr').robots).toBe('noindex, follow');
    expect(routeMeta('library', 'fr').robots).toBe('noindex, nofollow');
    expect(routeMeta('home', 'fr').robots).toBeUndefined();
    expect(routeMeta('movies', 'fr').robots).toBeUndefined();
  });

  it('withholds a path from the shell that answers for every unknown URL', () => {
    expect(routeMeta('notFound', 'fr').path).toBeUndefined();
  });
});

describe('renderSeoHead', () => {
  it('gives each route its own canonical instead of the home page’s', () => {
    const heads = SITE_ROUTES.map((r) => canonical(renderSeoHead(r, ORIGIN, 'fr')));
    expect(heads).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/movies`,
      `${ORIGIN}/tv`,
      `${ORIGIN}/search`,
      `${ORIGIN}/library`,
      null, // the 404 shell answers for every unknown URL and claims none
    ]);
  });

  it('gives each route its own title', () => {
    const titles = SITE_ROUTES.map(
      (r) => renderSeoHead(r, ORIGIN, 'fr').match(/<title>([^<]*)<\/title>/)?.[1],
    );
    expect(new Set(titles).size).toBe(SITE_ROUTES.length);
  });

  it('serves the noindex directive in the HTML rather than only after hydration', () => {
    expect(content(renderSeoHead(routeById('search'), ORIGIN, 'fr'), 'name', 'robots')).toBe(
      'noindex, follow',
    );
    expect(content(renderSeoHead(routeById('home'), ORIGIN, 'fr'), 'name', 'robots')).toBeNull();
  });

  it('points og:url at the same URL as the canonical', () => {
    const head = renderSeoHead(routeById('tv'), ORIGIN, 'fr');
    expect(content(head, 'property', 'og:url')).toBe(canonical(head));
  });

  it('carries the site structured data on the home page only', () => {
    expect(renderSeoHead(routeById('home'), ORIGIN, 'fr')).toContain('application/ld+json');
    expect(renderSeoHead(routeById('movies'), ORIGIN, 'fr')).not.toContain('application/ld+json');
  });

  it('escapes the ampersand a raw title would break the attribute with', () => {
    const head = renderSeoHead(routeById('home'), ORIGIN, 'fr');
    expect(head).toContain('cinéma &amp; séries');
    expect(head).not.toMatch(/content="[^"]*cinéma & séries/);
  });

  it('never lets a JSON-LD payload close its own script block', () => {
    const head = renderSeoHead(routeById('home'), ORIGIN, 'fr');
    const payload = head.slice(head.indexOf('ld+json'));
    expect(payload.match(/<\/script>/g)).toHaveLength(1);
  });

  it('applies the language it is asked for', () => {
    const head = renderSeoHead(routeById('movies'), ORIGIN, 'en');
    expect(head).toContain('<title>Movies · NEOX</title>');
    expect(content(head, 'property', 'og:locale')).toBe('en_US');
  });

  it('agrees with the meta the app applies after hydration', () => {
    for (const route of SITE_ROUTES) {
      const head = renderSeoHead(route, ORIGIN, 'fr');
      const meta = routeMeta(route.id, 'fr');
      expect(head).toContain(`<title>${escapeAttr(fullTitle(meta.title, 'fr'))}</title>`);
      expect(canonical(head)).toBe(meta.path ? `${ORIGIN}${meta.path}` : null);
      expect(content(head, 'name', 'robots')).toBe(meta.robots ?? null);
    }
  });
});

describe('renderNoscript', () => {
  it('gives a crawler that runs no JS a heading, a description and links out', () => {
    const html = renderNoscript(routeById('movies'), 'fr');
    expect(html).toContain('<h1>Films</h1>');
    expect(html).toContain('trouve ta prochaine séance');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/tv"');
  });

  it('does not link a page to itself', () => {
    expect(renderNoscript(routeById('tv'), 'fr')).not.toContain('href="/tv"');
  });

  it('heads the home page with the site, not with a carousel slide', () => {
    expect(renderNoscript(routeById('home'), 'fr')).toContain(
      '<h1>Ton radar cinéma &amp; séries</h1>',
    );
  });
});

describe('buildSitemapXml', () => {
  const xml = buildSitemapXml(ORIGIN);

  it('lists exactly the indexable routes, as absolute canonical URLs', () => {
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${ORIGIN}/`, `${ORIGIN}/movies`, `${ORIGIN}/tv`]);
  });

  it('leaves out the surfaces served noindex', () => {
    expect(xml).not.toContain('<loc>' + ORIGIN + '/search');
    expect(xml).not.toContain('<loc>' + ORIGIN + '/library');
  });

  it('opens with the XML declaration a sitemap is required to have', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('is rewritten wholesale by the deploy origin swap', () => {
    expect(buildSitemapXml(PLACEHOLDER_ORIGIN).replaceAll(PLACEHOLDER_ORIGIN, ORIGIN)).toBe(xml);
  });
});

describe('buildHomeGraphLd', () => {
  const graph = buildHomeGraphLd(ORIGIN, 'fr');
  const nodes = graph['@graph'] as Record<string, unknown>[];

  it('declares the site and its publisher in one block', () => {
    expect(nodes.map((n) => n['@type'])).toEqual(['WebSite', 'Organization']);
  });

  it('states the context once, on the graph', () => {
    expect(graph['@context']).toBe('https://schema.org');
    for (const node of nodes) expect(node['@context']).toBeUndefined();
  });

  it('declares a search endpoint that resolves against this origin', () => {
    const action = nodes[0].potentialAction as { target: { urlTemplate: string } };
    expect(action.target.urlTemplate).toBe(`${ORIGIN}/search?q={search_term_string}`);
  });
});
