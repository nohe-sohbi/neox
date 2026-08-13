/**
 * End-to-end scenario for NEOX: drives the real built app in Chromium against
 * the real backend, itself pointed at the local mock TMDB (see run.sh).
 *
 * Covers the product surface end to end: home + hero (pause included),
 * trending rail, fiche + share + instant reopen, episode tracking, library
 * search/filters/stats/exports, people + paginated search, URL-synced
 * Discover filters + surprise pick, accounts (password change, deletion),
 * API hardening + observability, locale detection, offline banner.
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3997';
const API = 'http://localhost:3001';
let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  ✗ ${name}: ${err.message.split('\n')[0]}`);
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch({
  executablePath: process.env.E2E_CHROMIUM || undefined,
});

// Main context: French UI (the detection follows the context locale).
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'fr-FR',
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

/* ─── Accueil ─── */
console.log('— Accueil —');
await page.goto(BASE, { waitUntil: 'networkidle' });

await check('le hero affiche un titre tendance', async () => {
  await page.waitForSelector('text=Fight Club', { timeout: 15000 });
});

await check("l'interface est en français (locale fr-FR détectée)", async () => {
  await page.waitForSelector('nav >> text=Films', { timeout: 5000 });
});

await check('le carrousel se met en pause (WCAG 2.2.2)', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[aria-label="Mettre le carrousel en pause"]');
  const title = await page.locator('h2.font-display').first().textContent();
  await page.waitForTimeout(7600); // one full auto-advance period
  const still = await page.locator('h2.font-display').first().textContent();
  assert(title === still, `le hero a avancé malgré la pause (${title} → ${still})`);
  await page.click('[aria-label="Relancer le carrousel"]');
});

await check('le rail Tendances bascule entre semaine et jour', async () => {
  const rail = page.locator('section:has(h2:text-is("Tendances"))');
  await rail.waitFor({ timeout: 10000 });
  const firstWeek = await rail.locator('a[href*="watch="]').first().getAttribute('href');
  await rail.locator('button:has-text("Aujourd’hui")').click();
  await page.waitForFunction(
    (prev) => {
      const sections = [...document.querySelectorAll('section')];
      const s = sections.find((el) => {
        const h = el.querySelector('h2');
        return h && h.textContent.trim() === 'Tendances';
      });
      const a = s && s.querySelector('a[href*="watch="]');
      return a && a.getAttribute('href') !== prev;
    },
    firstWeek,
    { timeout: 10000 },
  );
});

/* ─── Fiche + partage ─── */
console.log('— Fiche détaillée & partage —');
await page.goto(`${BASE}/?watch=movie-550`, { waitUntil: 'networkidle' });

await check('le deep link ouvre la fiche Fight Club', async () => {
  await page.waitForSelector('[role="dialog"] >> text=Fight Club', { timeout: 15000 });
});

await check('le bouton Partager copie le lien canonique + toast', async () => {
  await page.click('[role="dialog"] button:has-text("Partager")');
  await page.waitForSelector('text=Lien copié', { timeout: 5000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.endsWith('/?watch=movie-550'), `clipboard = ${copied}`);
});

await check('rouvrir une fiche ne refait aucune requête', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/movie/680')) calls += 1;
  });
  await page.goto(`${BASE}/?watch=movie-680`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role="dialog"] >> text=Pulp Fiction', { timeout: 15000 });
  const afterFirst = calls;
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 });
  // Reopen through in-app navigation (a full reload would reset the cache).
  await page.evaluate(() => history.pushState({}, '', '/?watch=movie-680'));
  await page.goBack();
  await page.goForward();
  await page.waitForSelector('[role="dialog"] >> text=Pulp Fiction', { timeout: 5000 });
  assert(afterFirst === 1, `1re ouverture: ${afterFirst} requêtes`);
  assert(calls === afterFirst, `réouverture: ${calls - afterFirst} requêtes de trop`);
});

/* ─── Statuts & épisodes ─── */
console.log('— Statuts & épisodes —');
await check('la fiche propose et applique le statut « En cours »', async () => {
  await page.goto(`${BASE}/?watch=movie-550`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role="dialog"] >> text=Fight Club', { timeout: 15000 });
  await page.click('[role="dialog"] button:has-text("En cours")');
  await page.waitForSelector('text=Marqué comme en cours', { timeout: 5000 });
});

await check('un second titre est marqué « À voir »', async () => {
  await page.goto(`${BASE}/?watch=movie-680`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role="dialog"] >> text=Pulp Fiction', { timeout: 15000 });
  await page.click('[role="dialog"] button:has-text("À voir")');
  await page.waitForSelector('text=Ajouté à « À voir »', { timeout: 5000 });
  await page.keyboard.press('Escape');
});

await check('cocher un épisode inscrit la série en « En cours »', async () => {
  await page.goto(`${BASE}/?watch=tv-1396`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role="dialog"] >> text=Breaking Bad', { timeout: 15000 });
  await page.click('[aria-label="Marquer S1 E1 comme vu"]');
  await page.click('[aria-label="Marquer S1 E2 comme vu"]');
  // Progress shows up on the season tab and under the list.
  await page.waitForSelector('[role="tab"]:has-text("2/8")', { timeout: 5000 });
  await page.waitForSelector('text=2/8 vus', { timeout: 5000 });
});

await check('la progression des épisodes survit à un rechargement', async () => {
  await page.goto(`${BASE}/?watch=tv-1396`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[role="dialog"] >> text=Breaking Bad', { timeout: 15000 });
  await page.waitForSelector('[aria-label="S1 E1 vu — cliquer pour retirer"]', { timeout: 5000 });
});

await check('les onglets de saisons répondent aux flèches du clavier', async () => {
  await page.focus('[role="tab"]:has-text("Saison 1")');
  await page.keyboard.press('ArrowRight');
  const selected = await page.locator('[role="tab"][aria-selected="true"]').textContent();
  assert(selected && selected.includes('Saison 2'), `onglet sélectionné: ${selected}`);
  await page.keyboard.press('Escape');
});

await check('Ma liste filtre par statut « En cours »', async () => {
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("En cours")');
  await page.waitForSelector('text=Fight Club', { timeout: 5000 });
  await page.waitForSelector('text=Breaking Bad', { timeout: 5000 });
  assert(!(await page.isVisible('text=Pulp Fiction')), 'Pulp Fiction ne doit pas apparaître');
});

/* ─── Ma liste : recherche, filtres, stats, exports ─── */
console.log('— Ma liste : recherche, filtres, stats, exports —');
const libSearch = 'input[placeholder^="Rechercher dans ma liste"]';

await check('la recherche texte filtre la liste (insensible aux accents)', async () => {
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
  await page.fill(libSearch, 'FÍGHT');
  await page.waitForSelector('text=Fight Club', { timeout: 5000 });
  assert(!(await page.isVisible('text=Pulp Fiction')), 'seul Fight Club doit rester');
});

await check('un terme sans correspondance affiche l’état « aucun titre »', async () => {
  await page.fill(libSearch, 'zzzz-introuvable');
  await page.waitForSelector('text=Aucun titre ne correspond', { timeout: 5000 });
  await page.fill(libSearch, '');
});

await check('le filtre Films / Séries restreint par type', async () => {
  await page.click('button[aria-pressed]:has-text("Séries")');
  await page.waitForSelector('text=Breaking Bad', { timeout: 5000 });
  assert(!(await page.isVisible('text=Fight Club')), 'Films exclus du filtre Séries');
  await page.click('button[aria-pressed]:has-text("Films")');
  await page.waitForSelector('text=Fight Club', { timeout: 5000 });
  assert(!(await page.isVisible('text=Breaking Bad')), 'Séries exclues du filtre Films');
});

await check('les statistiques montrent la note TMDB moyenne', async () => {
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Voir mes statistiques")');
  await page.waitForSelector('text=Note TMDB moyenne', { timeout: 5000 });
});

await check('l’export CSV télécharge un fichier lisible par un tableur', async () => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('button:has-text("Export CSV")'),
  ]);
  assert(download.suggestedFilename().endsWith('.csv'), download.suggestedFilename());
  const path = await download.path();
  const content = fs.readFileSync(path, 'utf8');
  assert(content.charCodeAt(0) === 0xfeff, 'BOM manquant');
  assert(content.includes('title,type,year,status'), 'en-tête manquant');
  assert(content.includes('Fight Club'), 'contenu manquant');
});

/* ─── Recherche : personnes & pagination ─── */
console.log('— Recherche : personnes & pagination —');
await check('la recherche affiche une section Personnes', async () => {
  await page.goto(`${BASE}/search?q=brad`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Personnes', { timeout: 10000 });
  await page.waitForSelector('text=Brad Pitt', { timeout: 5000 });
});

await check('cliquer une personne ouvre sa fiche', async () => {
  await page.click('a:has-text("Brad Pitt")');
  await page.waitForSelector('[role="dialog"] >> text=Brad Pitt', { timeout: 10000 });
  await page.keyboard.press('Escape');
});

await check('la recherche pagine en scroll (33 résultats « galaxie »)', async () => {
  await page.goto(`${BASE}/search?q=galaxie`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=33 résultats', { timeout: 10000 });
  const before = await page.locator('a[href*="watch=movie-9"]').count();
  assert(before === 20, `page 1 doit montrer 20 cartes, vu ${before}`);
  await page.mouse.wheel(0, 30000);
  await page.waitForFunction(
    () => document.querySelectorAll('a[href*="watch=movie-9"]').length >= 33,
    { timeout: 10000 },
  );
});

/* ─── Explorer : filtres URL, compteur, surprise ─── */
console.log('— Explorer —');
await check('les filtres écrivent l’URL', async () => {
  await page.goto(`${BASE}/movies`, { waitUntil: 'networkidle' });
  await page.waitForSelector('button:has-text("Action")', { timeout: 10000 });
  await page.click('button:has-text("Action")');
  await page.click('button[aria-pressed]:has-text("8+")');
  await page.waitForFunction(
    () => location.search.includes('genre=28') && location.search.includes('rating=8'),
    { timeout: 5000 },
  );
});

await check('un rechargement restaure les filtres et montre le compteur', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  const pressed = await page.locator('button[aria-pressed="true"]:has-text("8+")').count();
  assert(pressed === 1, 'le filtre 8+ doit rester actif après reload');
  await page.waitForSelector('text=/titres? trouvés?/', { timeout: 10000 });
});

await check('« Surprends-moi » ouvre un titre au hasard', async () => {
  await page.goto(`${BASE}/movies`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Surprends-moi")');
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.keyboard.press('Escape');
});

/* ─── Compte ─── */
console.log('— Compte —');
const email = `e2e-${Math.random().toString(36).slice(2, 10)}@neox.test`;
const pass1 = 'motdepasse1';
const pass2 = 'motdepasse2';

// The auth/account modals reset their fields in a passive effect right after
// opening; a fill racing that effect gets wiped and the submit then stalls on
// native `required` validation. Fill, give the effect time to run, verify the
// value survived, refill if not.
async function fillStable(selector, value) {
  for (let i = 0; i < 5; i++) {
    await page.fill(selector, value);
    await page.waitForTimeout(80);
    if ((await page.inputValue(selector)) === value) return;
  }
  throw new Error(`la valeur de ${selector} ne survit pas à l'effet d'ouverture`);
}

// The auth modal keeps its login/register mode between opens; normalize it.
async function openAuthModal(mode) {
  await page.click('button:has-text("Connexion")');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  if (mode === 'login' && (await page.isVisible('button:has-text("Connecte-toi")'))) {
    await page.click('button:has-text("Connecte-toi")');
  }
  if (mode === 'register' && (await page.isVisible('button:has-text("Inscris-toi")'))) {
    await page.click('button:has-text("Inscris-toi")');
  }
}

async function waitForOrDump(selector, timeout) {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch {
    const dump = await page
      .locator('[role="dialog"]')
      .innerText()
      .catch(() => '(pas de modale)');
    throw new Error(`introuvable: ${selector} — contenu modale: ${dump.replace(/\n+/g, ' | ')}`);
  }
}

await check("l'œil révèle puis masque le mot de passe", async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await openAuthModal('login');
  await fillStable('[role="dialog"] input[type="password"]', 'secret-visible');
  await page.click('[aria-label="Afficher le mot de passe"]');
  const revealed = await page.inputValue('[role="dialog"] input[type="text"]');
  assert(revealed === 'secret-visible', `champ révélé: ${revealed}`);
  await page.click('[aria-label="Masquer le mot de passe"]');
  await page.waitForSelector('[role="dialog"] input[type="password"]', { timeout: 3000 });
  await page.keyboard.press('Escape');
});

await check("l'inscription crée un compte et connecte", async () => {
  await openAuthModal('register');
  await fillStable('input[type="email"]', email);
  await fillStable('input[type="password"]', pass1);
  await page.click('button:has-text("Créer mon compte")');
  await page.waitForSelector(`[aria-label="Mon compte"]`, { timeout: 10000 });
});

await check('le changement de mot de passe fonctionne', async () => {
  await page.click('[aria-label="Mon compte"]');
  await page.click('button:has-text("Mon compte")');
  await fillStable('input[placeholder="Mot de passe actuel"]', pass1);
  await fillStable('input[placeholder*="Nouveau mot de passe"]', pass2);
  await page.click('button:has-text("Mettre à jour")');
  await page.waitForSelector('text=Mot de passe mis à jour', { timeout: 10000 });
});

await check('la session survit au changement (jeton réémis)', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[aria-label="Mon compte"]', { timeout: 10000 });
});

await check('reconnexion : l’ancien mot de passe est refusé, le nouveau accepté', async () => {
  await page.click('[aria-label="Mon compte"]');
  await page.click('button:has-text("Se déconnecter")');
  await openAuthModal('login');
  await fillStable('input[type="email"]', email);
  await fillStable('input[type="password"]', pass1);
  await page.click('button:has-text("Se connecter")');
  await waitForOrDump('text=E-mail ou mot de passe incorrect', 10000);
  await fillStable('input[type="password"]', pass2);
  await page.click('button:has-text("Se connecter")');
  await page.waitForSelector('[aria-label="Mon compte"]', { timeout: 10000 });
});

await check('la suppression de compte est confirmée puis effective', async () => {
  await page.click('[aria-label="Mon compte"]');
  await page.click('button:has-text("Mon compte")');
  page.once('dialog', (d) => d.accept());
  await fillStable('input[placeholder="Confirme avec ton mot de passe"]', pass2);
  await page.click('button:has-text("Supprimer mon compte")');
  await page.waitForSelector('text=Compte supprimé', { timeout: 10000 });

  // Le login doit maintenant échouer.
  await openAuthModal('login');
  await fillStable('input[type="email"]', email);
  await fillStable('input[type="password"]', pass2);
  await page.click('button:has-text("Se connecter")');
  await waitForOrDump('text=E-mail ou mot de passe incorrect', 10000);
  await page.keyboard.press('Escape');
});

/* ─── API : durcissement, observabilité, santé ─── */
console.log('— API —');
await check('un login non-string répond 400, pas 500', async () => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 123, password: {} }),
  });
  assert(res.status === 400, `attendu 400, reçu ${res.status}`);
});

await check('un tri inconnu est remplacé, la réponse reste 200', async () => {
  const res = await fetch(`${API}/api/discover/movie?sort=$evil|inject&page=99999`);
  assert(res.status === 200, `attendu 200, reçu ${res.status}`);
});

await check('chaque réponse porte un X-Request-Id, écho compris', async () => {
  const fresh = await fetch(`${API}/api/health`);
  assert(/^[0-9a-f-]{36}$/.test(fresh.headers.get('x-request-id') || ''), 'id généré manquant');
  const echoed = await fetch(`${API}/api/health`, { headers: { 'X-Request-Id': 'e2e-run-1' } });
  assert(echoed.headers.get('x-request-id') === 'e2e-run-1', 'id entrant non écho');
});

await check('/api/health répond ok et annonce sa version', async () => {
  const res = await fetch(`${API}/api/health`);
  const body = await res.json();
  assert(body.status === 'ok' && body.tmdb === 'configured', JSON.stringify(body).slice(0, 100));
  assert(/^\d+\.\d+\.\d+$/.test(body.version), `version: ${body.version}`);
});

/* ─── Hors ligne ─── */
console.log('— Hors ligne —');
await check('le bandeau hors-ligne apparaît et disparaît', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await ctx.setOffline(true);
  await page.waitForSelector('text=Hors ligne — contenu servi depuis le cache', { timeout: 5000 });
  await ctx.setOffline(false);
  await page.waitForSelector('text=Hors ligne — contenu servi depuis le cache', {
    state: 'detached',
    timeout: 5000,
  });
});

/* ─── Détection de langue ─── */
console.log('— Détection de langue —');
const enCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const enPage = await enCtx.newPage();

await check('un premier visiteur en-US voit l’interface en anglais', async () => {
  await enPage.goto(BASE, { waitUntil: 'networkidle' });
  await enPage.waitForSelector('nav >> text=Movies', { timeout: 10000 });
  const stored = await enPage.evaluate(() => localStorage.getItem('neox.locale.v1'));
  assert(stored && stored.includes('en-US'), `locale persistée: ${stored}`);
});

const deCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const dePage = await deCtx.newPage();
await check('un premier visiteur de-DE voit l’interface en allemand', async () => {
  await dePage.goto(BASE, { waitUntil: 'networkidle' });
  await dePage.waitForSelector('nav >> text=Filme', { timeout: 10000 });
});

/* ─── Bilan ─── */
await check('aucune erreur JavaScript sur la page principale', async () => {
  assert(pageErrors.length === 0, `erreurs: ${pageErrors.join(' | ')}`);
});

console.log(`\n${passed} passés, ${failed} échoués`);
if (failures.length) {
  console.log('\n=== Échecs ===');
  for (const f of failures) console.log(`FAIL: ${f.name}\n${f.err.stack}\n`);
}
await browser.close();
process.exit(failed ? 1 : 0);
