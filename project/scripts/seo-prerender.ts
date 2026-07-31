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

function replaceBlock(html: string, open: string, close: string, content: string): string {
  const from = html.indexOf(open);
  const to = html.indexOf(close);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `[seo-prerender] index.html is missing the ${open} … ${close} markers. ` +
        'They delimit what the build rewrites per route; restore them or the ' +
        'shells would all ship the home page head.',
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
      const template = String(shell.source);

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
