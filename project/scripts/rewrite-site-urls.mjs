/**
 * `robots.txt` and `sitemap.xml` are static files, but the origin they point at
 * is only known at deploy time. They ship with a placeholder; this rewrites the
 * built copies so a deployed NEOX never sends crawlers to a domain it does not
 * own. Runs automatically after `npm run build` (see the `postbuild` script).
 *
 * Set VITE_SITE_URL — the same variable that drives canonical/og:url tags — to
 * activate it. Left unset, the placeholder stays and the build still succeeds.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PLACEHOLDER = 'https://neox.app';
const FILES = ['robots.txt', 'sitemap.xml'];

const distDir = path.resolve(process.cwd(), 'dist');
const origin = (process.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');

if (!origin) {
  console.log(
    `[site-urls] VITE_SITE_URL unset — leaving ${PLACEHOLDER} in ${FILES.join(' / ')}.`,
  );
  process.exit(0);
}

if (!/^https?:\/\//.test(origin)) {
  console.error(`[site-urls] VITE_SITE_URL must be an absolute URL, got "${origin}".`);
  process.exit(1);
}

if (origin === PLACEHOLDER) {
  console.log('[site-urls] VITE_SITE_URL matches the placeholder — nothing to rewrite.');
  process.exit(0);
}

for (const file of FILES) {
  const target = path.join(distDir, file);
  const source = await readFile(target, 'utf8');
  const rewritten = source.replaceAll(PLACEHOLDER, origin);

  if (rewritten === source) {
    console.warn(`[site-urls] ${file}: no "${PLACEHOLDER}" occurrence found — left untouched.`);
    continue;
  }

  await writeFile(target, rewritten);
  console.log(`[site-urls] ${file} → ${origin}`);
}
