# SEO — audit et backlog

Audit technique du dépôt NEOX. Priorité `P0` (bloque l'indexation) → `P2` (gain
marginal), effort `S` (< 1 h) / `M` (une demi-journée) / `L` (chantier).

## Reconnaissance

| | |
|---|---|
| Stack | React 18 + TypeScript + Vite 5 + Tailwind, `react-router-dom` v6 |
| Rendu | **CSR pur.** Aucun SSR, SSG ni ISR. `dist/index.html` est un shell unique servi tel quel pour toutes les routes |
| Serveur | nginx statique + proxy `/api` (`project/nginx.conf`), `try_files $uri $uri/ /index.html` |
| Métadonnées | Centralisées et propres, mais **appliquées côté client** : `lib/seo.ts` (`buildMeta`/`applyMeta`) + `hooks/useDocumentMeta.ts` (snapshot/restore) |
| Données structurées | `lib/structured-data.ts` : `WebSite`+`SearchAction`, `Movie`/`TVSeries`, `Person`. Honnêtes (`aggregateRating` conditionné à un `voteCount` réel). **Injectées côté client** |
| Routes | `/`, `/movies`, `/tv`, `/search`, `/library`, `*` → redirection vers `/` |
| Fiches | Pas de route dédiée : deep-link par paramètre, `?watch=movie-550`, `?person=1234` |
| robots.txt | Présent, `Allow: /`, déclare le sitemap |
| sitemap.xml | Statique, 3 URLs (`/`, `/movies`, `/tv`), pas de `lastmod` |
| i18n | 5 langues (fr, en, es, de, it), résolues côté client depuis `localStorage`. **Une seule URL par langue**, pas de hreflang |
| Origine | `VITE_SITE_URL` réécrit `robots.txt`, `sitemap.xml` et `index.html` au postbuild (`scripts/rewrite-site-urls.mjs`) |

### Le HTML réellement servi

`npm run build` puis lecture de `dist/index.html` — c'est l'octet près ce que reçoit
un crawler sur **chacune** des cinq routes :

```html
<title>NEOX · Ton radar cinéma & séries</title>
<link rel="canonical" href="https://neox.app/" />
<meta property="og:url" content="https://neox.app/" />
<body><div id="root"></div></body>
```

Corps de page vide (0 caractère de texte), aucun JSON-LD, aucun `meta robots`.
Titre, description, canonique et données structurées n'existent qu'après hydratation.

---

## 🔴 Crawl & indexation

- [x] **1. Canonique unique pointant sur `/` pour toutes les URLs** — `/movies` et `/tv` sont dans le sitemap mais servent `canonical: https://neox.app/`. Signal contradictoire : Google lit « doublons de la home » et les désindexe. Le bug le plus coûteux du lot, et le moins cher à corriger. · **P0 / M**
- [x] **2. Title + description du HTML servi identiques sur toutes les routes** — celui de la home partout. `/movies` et `/tv` n'ont aucun signal on-page propre avant hydratation. · **P0 / M**
- [x] **3. `noindex` de `/search` et `/library` absent du HTML servi** — la directive n'apparaît qu'après JS. `robots.txt` documente pourtant l'intention (« crawl allowed, indexing refused ») : elle n'est pas tenue pour les crawlers qui ne rendent pas. · **P0 / S**
- [x] **4. Corps de page vide pour tout crawler sans exécution JS** — moteurs de réponse et crawlers IA (GPTBot, PerplexityBot, ClaudeBot…) reçoivent une page blanche. · **P0 / L**
- [x] **5. Soft 404 sur toute URL inconnue** — `<Route path="*" element={<Navigate to="/" replace />} />` : `/nimportequoi` répond 200 et affiche la home. Google classe ça en soft 404 et, pire, chaque URL erronée devient un doublon de l'accueil. · **P0 / M**
- [x] **6. Fiches et profils totalement orphelins** — `MediaCard` est un `<div role="button">`, le casting des `<button>`. Aucun `<a href>` ne pointe vers `?watch=` ou `?person=` : aucune fiche n'est découvrable au crawl, et le lien n'est ni ouvrable dans un nouvel onglet ni annoncé comme lien aux lecteurs d'écran. · **P0 / M**
- [x] **7. Pas d'unicité trailing slash** — `try_files $uri $uri/` fait répondre 200 à `/movies` **et** `/movies/`. Doublon strict. · **P1 / S**
- [x] **8. Aucun JSON-LD dans le HTML servi** — `WebSite` + `SearchAction` (donc l'éligibilité au sitelinks searchbox) ne sont visibles qu'après rendu JS. · **P1 / M**
- [x] **9. Sitemap désynchronisé du code** — liste statique maintenue à la main, rien ne casse si une route est ajoutée ou renommée. Désormais généré depuis le manifeste. `lastmod` volontairement omis : la seule date connue du build est la sienne, et l'estampiller sur des pages dont le catalogue change tous les jours sous-évaluerait leur fraîcheur dès qu'un déploiement s'espace. · **P1 / S**
- [x] **10. Réponses `/api/*` indexables** — corrigé par un en-tête `X-Robots-Tag: noindex`, **pas** par un `Disallow` : l'app est rendue côté client, Googlebot appelle ces endpoints pendant le rendu, et les bloquer dans `robots.txt` lui ferait rendre une app vide. L'en-tête est lu après le fetch, donc rien n'est empêché. · **P2 / S**

## 🟡 On-page & données structurées

- [ ] **11. Le H1 de la home est un titre de film qui change toutes les 7 secondes** — le carrousel du hero porte le seul `<h1>` de la page. L'accueil n'a aucun titre stable qui le décrive, et un lecteur d'écran qui navigue par titres tombe sur un slide. · **P1 / S**
- [x] **12. `Organization` absent** — seul `WebSite` est émis. L'entité éditrice n'est jamais déclarée. · **P2 / S**
- [x] **13. `og:locale` injecté en JS** — ajouté par `main.tsx`, donc absent du HTML lu par les unfurlers qui n'exécutent rien. · **P2 / S**
- [x] **14. `og:image:alt` absent** — l'aperçu social n'avait pas d'alternative textuelle. `twitter:site` reste absent : NEOX n'a pas de compte connu, et en inventer un serait une fausse déclaration. · **P2 / S**
- [x] **15. Liens internes sans ancre descriptive vers les rubriques** — le footer ne renvoie nulle part ; le maillage repose entièrement sur la navbar. · **P2 / S**
- [ ] **16. Pas de `BreadcrumbList`** — pas de fil d'Ariane, mais l'arborescence est plate (une seule profondeur) : le gain est faible et le markup serait artificiel. *Écarté volontairement, voir « Non retenu ».* · **P2 / M**

## 🟢 Core Web Vitals & performance

- [ ] **17. Pas de `preconnect` vers `image.tmdb.org`** — toutes les affiches viennent de ce hôte, et la connexion (DNS + TLS) n'est ouverte qu'après le parsing du bundle et la réponse de l'API. Coût direct sur le LCP. · **P1 / S**
- [ ] **18. Le hero télécharge les 5 backdrops d'un coup** — tous les slides sont montés, `opacity-0` ne dispense pas du téléchargement, et l'image LCP n'a pas de `fetchpriority`. · **P1 / M**
- [ ] **19. `loading="lazy"` sur toutes les cartes, y compris above-the-fold** — sur `/movies` et `/tv` la première rangée est l'élément LCP et part en chargement différé. · **P1 / S**
- [ ] **20. Pas de `width`/`height` sur les `<img>`** — le CLS est déjà tenu par les conteneurs `aspect-[2/3]`, mais les attributs manquent pour les cas non contraints. · **P2 / S**
- [ ] **21. Bundle monolithique (316 kB / 96 kB gzip), pas de code splitting par route** — `/library` embarque le lecteur de saisons, la palette, la modale de détail. *Reporté, voir « Non retenu ».* · **P2 / M**
- [ ] **22. Polices non préchargées** — `font-display: swap` est bien en place (fontsource), mais le woff2 de Bricolage Grotesque, utilisé par le H1, n'est découvert qu'après le CSS. *Reporté, voir « Non retenu ».* · **P2 / M**

---

## Non retenu / à valider

Ces points sont identifiés mais **non implémentés** : ils demandent un arbitrage
produit ou une validation qui ne peut pas se faire depuis le dépôt.

1. **SSR/SSG des fiches titres (`?watch=movie-550`)** — *le plafond de verre du SEO
   de NEOX*. Les fiches sont le vrai contenu (synopsis, casting, disponibilité), et
   elles resteront invisibles pour tout moteur qui ne rend pas le JS. Les servir
   pré-rendues suppose un rendu à la requête avec la clé TMDB, donc un serveur Node
   devant nginx au lieu d'un bundle statique : changement d'architecture de
   déploiement. Recommandation : passer les fiches sur de vraies URLs
   (`/film/550-fight-club`) rendues côté serveur, avec 301 depuis `?watch=`.
   **Décision produit.**
2. **hreflang / URLs par langue** — 5 langues servies sur les mêmes URLs depuis
   `localStorage`. Google n'indexe qu'une version, les 4 autres n'existent pas pour
   lui. Corriger suppose une structure d'URL par langue (`/en/movies`) et donc des
   301 : **décision produit**, pas une correction technique.
3. **`BreadcrumbList`** — arborescence plate, le fil d'Ariane serait du markup pour
   du contenu qui n'est pas à l'écran. Écarté au nom de l'honnêteté du balisage.
4. **Code splitting par route + preload des polices** — gains CWV réels mais
   mesurables uniquement sur un déploiement réel (Lighthouse / CrUX). À faire après
   une mesure de terrain, pas à l'aveugle.
5. **Vérifications impossibles depuis le dépôt** — rendu Googlebot live, Rich
   Results Test, couverture Search Console, positions réelles. Le JSON-LD est validé
   structurellement par les tests unitaires, pas par l'outil de Google.
