/**
 * Build-time prerender of one HTML shell per route.
 *
 * Vite emits a single `index.html`, and nginx hands that same file to every URL.
 * The consequence is not subtle: `/movies` and `/tv` are listed in the sitemap
 * while serving `<link rel="canonical" href="https://neox.app/">`, which tells
 * Google they are duplicates of the home page and should be dropped. `/search`
 * and `/library` are served without the `noindex` the app applies later, and no
 * crawler that skips JavaScript ever sees a title, a description or a JSON-LD
 * block.
 *
 * So the build writes them. For every route in the manifest it takes the shell
 * Vite produced, swaps the marked `<head>` block for that route's tags and the
 * marked body block for its no-JS content, and emits `movies.html`, `tv.html`,
 * … next to `index.html`. `nginx.conf` serves `/movies` from `movies.html`; the
 * bundle then boots and React takes over exactly as before.
 *
 * Emitted through Rollup's asset API rather than `fs` so the plugin stays a pure
 * transform of the bundle, with no second writer racing Vite's own output.
 *
 * The origin is the placeholder: `scripts/rewrite-site-urls.mjs` swaps it for
 * `VITE_SITE_URL` in every emitted file once the build is on disk.
 */
import type { Plugin } from 'vite';
import {
  PLACEHOLDER_ORIGIN,
  SITE_ROUTES,
  buildSitemapXml,
  renderNoscript,
  renderSeoHead,
} from '../src/lib/routes';
import type { Lang } from '../src/lib/i18n/core';

/**
 * The language the shells are written in. The app resolves the real UI language
 * from the visitor's stored locale and re-applies the head on boot; this is what
 * a crawler, and a first visit with no preference, get served.
 */
const PRERENDER_LANG: Lang = 'fr';

const HEAD_OPEN = '<!--seo:head-->';
const HEAD_CLOSE = '<!--/seo:head-->';
const NOSCRIPT_OPEN = '<!--seo:noscript-->';
const NOSCRIPT_CLOSE = '<!--/seo:noscript-->';
const PRELOAD_OPEN = '<!--build:preload-->';
const PRELOAD_CLOSE = '<!--/build:preload-->';

/**
 * Subsets to preload: the two families the first screen is written in, latin
 * only. Their files are content-hashed, so the names are only knowable here,
 * from the bundle. Without this the browser discovers them at the end of the
 * CSS, and `font-display: swap` pays for it with a visible re-flow of the
 * heading — which is the LCP element on a section page.
 *
 * latin-ext and vietnamese stay out on purpose: preloading a subset the page
 * does not use spends LCP bandwidth on nothing.
 */
const PRELOADED_FONTS = [
  /^assets\/bricolage-grotesque-latin-wght-normal-[^/]+\.woff2$/,
  /^assets\/instrument-sans-latin-wght-normal-[^/]+\.woff2$/,
];

/**
 * `crossorigin` is not optional even same-origin: a font is fetched in
 * anonymous CORS mode, and a preload without it warms a different, unusable
 * connection — the file then downloads twice.
 */
function renderFontPreloads(fileNames: string[]): string {
  const fonts = PRELOADED_FONTS.flatMap((pattern) => fileNames.filter((f) => pattern.test(f)));
  if (fonts.length === 0) return '\n    ';
  const links = fonts.map(
    (f) => `<link rel="preload" as="font" type="font/woff2" href="/${f}" crossorigin />`,
  );
  return `\n    ${links.join('\n    ')}\n    `;
}

function replaceBlock(html: string, open: string, close: string, content: string): string {
  const from = html.indexOf(open);
  const to = html.indexOf(close);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `[seo-prerender] index.html is missing the ${open} … ${close} markers. ` +
        'They delimit what the build rewrites; restore them or the shells would ' +
        'all ship the home page head.',
    );
  }
  return html.slice(0, from + open.length) + content + html.slice(to);
}

export function seoPrerender(): Plugin {
  return {
    name: 'neox:seo-prerender',
    // After Vite's own HTML plugin has produced index.html, and only on build:
    // the dev server serves index.html straight from the project root.
    enforce: 'post',
    apply: 'build',

    generateBundle(_options, bundle) {
      const shell = bundle['index.html'];
      if (!shell || shell.type !== 'asset') {
        throw new Error('[seo-prerender] no index.html in the bundle, nothing to prerender.');
      }
      // Same for every shell, but only knowable once the bundle has its
      // content-hashed filenames.
      const template = replaceBlock(
        String(shell.source),
        PRELOAD_OPEN,
        PRELOAD_CLOSE,
        renderFontPreloads(Object.keys(bundle)),
      );

      for (const route of SITE_ROUTES) {
        const html = replaceBlock(
          replaceBlock(
            template,
            HEAD_OPEN,
            HEAD_CLOSE,
            renderSeoHead(route, PLACEHOLDER_ORIGIN, PRERENDER_LANG),
          ),
          NOSCRIPT_OPEN,
          NOSCRIPT_CLOSE,
          renderNoscript(route, PRERENDER_LANG),
        );

        if (route.file === 'index.html') shell.source = html;
        else this.emitFile({ type: 'asset', fileName: route.file, source: html });
      }

      // Generated from the same manifest, so a renamed route can never leave a
      // stale entry pointing at a URL that no longer answers.
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemapXml(PLACEHOLDER_ORIGIN),
      });
    },
  };
}
