/**
 * `robots.txt`, `sitemap.xml` and the prerendered HTML shells all carry absolute
 * URLs — canonical, `og:url`, sitemap `<loc>` — pointing at an origin that is
 * only known at deploy time. They ship with a placeholder; this rewrites the
 * built copies so a deployed NEOX never sends crawlers to a domain it does not
 * own. Runs automatically after `npm run build` (see the `postbuild` script).
 *
 * Every `*.html` in `dist/` is covered, not just `index.html`: the build emits
 * one shell per route (see `scripts/seo-prerender.ts`) and each carries its own
 * canonical, so missing one would leave that route pointing at the placeholder.
 *
 * Set VITE_SITE_URL (the same variable that drives the canonical/og:url tags in
 * the bundle) to activate it. Left unset, the placeholder stays and the build
 * still succeeds.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PLACEHOLDER = 'https://neox.app';

const distDir = path.resolve(process.cwd(), 'dist');
const origin = (process.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');

if (!origin) {
  console.log(`[site-urls] VITE_SITE_URL unset, leaving ${PLACEHOLDER} in the built files.`);
  process.exit(0);
}

if (!/^https?:\/\//.test(origin)) {
  console.error(`[site-urls] VITE_SITE_URL must be an absolute URL, got "${origin}".`);
  process.exit(1);
}

if (origin === PLACEHOLDER) {
  console.log('[site-urls] VITE_SITE_URL matches the placeholder, nothing to rewrite.');
  process.exit(0);
}

const entries = await readdir(distDir, { withFileTypes: true });
const files = [
  'robots.txt',
  'sitemap.xml',
  ...entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => e.name),
];

for (const file of files) {
  const target = path.join(distDir, file);
  const source = await readFile(target, 'utf8');
  const rewritten = source.replaceAll(PLACEHOLDER, origin);

  if (rewritten === source) {
    console.warn(`[site-urls] ${file}: no "${PLACEHOLDER}" occurrence found, left untouched.`);
    continue;
  }

  await writeFile(target, rewritten);
  console.log(`[site-urls] ${file} → ${origin}`);
}
