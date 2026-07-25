# 🗺️ NEOX — Roadmap to Ship

Statut : **v1 livrable**. App de découverte de films et séries adossée à TMDB, avec la
disponibilité sur les plateformes légales (« où regarder »). Ci-dessous : ce qui est fait,
et la suite, en étapes brutes et directes.

## ✅ Phase 0 — Livré dans ce commit

- [x] Backend réécrit : proxy TMDB caché, retry/backoff, validation, erreurs centralisées.
- [x] Endpoints : `home`, `search`, `discover`, `trending`, `genres`, `details`.
- [x] Frontend refondu : design system Tailwind, Navbar, Hero, rails, grid, fiche détaillée.
- [x] Recherche instantanée (debounce), Explorer (filtres + scroll infini), Watchlist (localStorage).
- [x] États loading / vide / erreur partout. Build + typecheck + lint verts.
- [x] Secret `.env` retiré du suivi git, `.gitignore` ajouté.

## 🚢 Phase 1 — Ship aujourd'hui (≈ 1–2 h)

1. **Clé TMDB** → `cp .env.example .env`, coller `TMDB_API_KEY`.
2. **Vérifier en local** → `docker compose up --build`, ouvrir http://localhost:5173.
   - Home charge, recherche « dune », ouvrir une fiche, lancer la BA, ajouter à la liste.
3. **Build prod du frontend** (optionnel mais recommandé) :
   - Passer le Dockerfile frontend en multi-stage `npm run build` + `nginx`/`vite preview`.
4. **Déployer** (Dokploy / Railway / Fly) :
   - Set `TMDB_API_KEY`, `TMDB_REGION`, `VITE_API_URL` (URL publique de l'API).
   - Retirer le bloc `ports` du backend si reverse proxy.
5. **Smoke test prod** → `/api/health` renvoie `"tmdb":"configured"`.

## ✅ Phase 2 — Rétention (LIVRÉ)

- [x] **Comptes + sync cloud** — auth self-contained (bcrypt + JWT + store JSON, **sans SaaS
      tiers**), bibliothèque localStorage-first fusionnée au compte à la connexion.
- [x] **Notation perso (1–10)** & statut **À voir / Vu**, avec filtres par statut dans Ma liste.
- [x] **Filtre « Mes plateformes »** — « seulement sur mon Netflix/Prime », préférence mémorisée.
- [x] **Routing react-router** + **deep links partageables** (`?watch=movie-550`) + navigation par routes.
- [x] **Hero** : préchargement des backdrops + skeletons affinés.

> Reste pour le « SEO complet » des fiches : SSR / prerender (les deep links fonctionnent déjà,
> mais le rendu est client-side). À traiter en Phase 3 si besoin (Next.js ou vite-plugin-ssr).

## ✅ Phase 3 — Croissance (LIVRÉ)

- [x] **Recommandations « Pour toi »** — agrégation des recommandations TMDB des titres de la
      bibliothèque, classées par fréquence × popularité.
- [x] **Personnes** — endpoint `/api/person/:id`, casting cliquable → bio + filmographie.
- [x] **PWA** — manifest + service worker (vite-plugin-pwa), installable, shell offline, cache images.
- [x] **Région & langue** — switcher catalogue (FR/US/ES/DE…), threadé jusqu'à TMDB (`region`/`lang`).
- [x] **Analytics** — Plausible opt-in (no-op sans `VITE_PLAUSIBLE_DOMAIN`).

## ✅ Tech debt / durcissement (LIVRÉ)

- [x] **Tests** : vitest (lib bibliothèque) + supertest (auth + sync) — 18 tests verts.
- [x] **Durcissement Express** : `helmet`, `compression`, `express-rate-limit` (global + auth).
- [x] **CI** : GitHub Actions (lint · typecheck · test · build) sur chaque PR.

## ✅ Phase 4 — UX, i18n & résilience (LIVRÉ)

- [x] **i18n complète de l'UI** — toutes les chaînes de l'interface sont traduites (FR · EN · ES ·
      DE · IT), pilotées par le sélecteur région/langue. Système maison sans dépendance
      (`lib/i18n`), fallback automatique vers l'anglais puis vers la clé, tests de parité des clés.
- [x] **Palette de commandes ⌘K / Ctrl+K** — lanceur clavier global : recherche instantanée,
      navigation rapide (Accueil/Films/Séries/Ma liste) et **recherches récentes** persistées.
      Navigation 100 % clavier (↑/↓/Entrée/Échap).
- [x] **Cache TMDB durci** — cache borné **LRU + TTL** (plus de fuite mémoire) avec
      **stale-while-revalidate** : en cas de panne TMDB, on sert la donnée légèrement périmée
      plutôt qu'une erreur. Métriques exposées dans `/api/health`. Module isolé et testé.

## ✅ Phase 5 — Perf, data ownership & a11y (LIVRÉ)

Trois axes d'amélioration majeurs, sans dépendance ni infra externe :

- [x] **Cache HTTP (perf backend)** — les endpoints de lecture renvoient désormais `Cache-Control`
      (`max-age` + `s-maxage` + `stale-while-revalidate`) et des **ETags forts**. Navigateurs et CDN
      réutilisent les réponses et reçoivent un **304** quand rien n'a changé ; les erreurs ne sont
      jamais marquées cacheables et les routes privées (auth/library/health) sont en `no-store`.
      Middlewares isolés et testés (`backend/http-cache.js`).
- [x] **Export / import de la bibliothèque + tri (feature)** — sauvegarde JSON versionnée et
      restauration portables (sans compte), import re-validé et fusionné (le plus récent gagne), plus
      un tri configurable (ajout, titre, note TMDB, note perso, année). Logique pure et testée
      (`project/src/lib/library-io.ts`).
- [x] **Accessibilité des modales (qualité/UX)** — hook `useModal` partagé par les 4 overlays
      (fiche, personne, auth, palette ⌘K) : **piège de focus**, restauration du focus, `Escape`,
      verrou de scroll et `role="dialog"` / `aria-modal`. Les dialogues empilés ne se disputent plus
      les raccourcis (seul celui qui a le focus réagit).

## ✅ Phase 6 — Débit, découverte & SEO (LIVRÉ)

Trois axes d'amélioration majeurs, toujours sans dépendance ni infra externe :

- [x] **Coalescing de requêtes / single-flight (perf & résilience backend)** — au-delà du
      cache LRU+TTL, les **cache-miss concurrents** sur une même URL TMDB ne déclenchent plus
      qu'**un seul appel amont** : le premier appelant fait le travail, les autres attendent la même
      promesse (protection thundering-herd, économie de quota TMDB sous charge). Module isolé et
      testé (`backend/single-flight.js`), métriques (`coalesced`/`flights`/`inFlight`) exposées dans
      `/api/health`.
- [x] **Filtres avancés « Explorer » (feature)** — en plus du genre/tri/plateformes, on filtre
      désormais par **année de sortie** (sélecteur) et **note minimale** (6+/7+/8+/9+, avec un
      plancher de votes relevé pour écarter le bruit). Mapping TMDB pur et testé
      (`buildDiscoverParams`), threadé jusqu'à l'UI et i18n (FR·EN·ES·DE·IT).
- [x] **SEO dynamique & cartes sociales (croissance/UX)** — chaque route et chaque fiche/personne
      pilote le `<head>` : `title`, `description`, **Open Graph + Twitter Card** (avec poster), URL
      canonique. Les overlays restaurent proprement le head à la fermeture (snapshot/restore).
      `robots.txt` + `sitemap.xml` ajoutés. Logique pure et testée (`project/src/lib/seo.ts`).

## ✅ Phase 7 — Perf client, reprise & résilience (LIVRÉ)

Trois axes d'amélioration majeurs, toujours sans dépendance ni infra externe :

- [x] **Cache de données côté client (perf frontend)** — un cache mémoire borné par clé avec
      **stale-while-revalidate** et **dédup des requêtes en vol** (`lib/query.ts` + hook
      `useQuery`). Revenir sur l'Accueil ou changer d'onglet Films/Séries **repeint
      instantanément** depuis le cache (plus de skeleton qui clignote) puis revalide en arrière-plan ;
      les lectures concurrentes d'une même clé ne déclenchent qu'**un seul appel réseau**. Le cœur
      (fraîcheur/cache/dédup) est pur et **testé**.
- [x] **« Vu récemment » / reprise de visionnage (feature)** — les fiches ouvertes sont mémorisées
      localement (sans compte), **dédupliquées et bornées**, et resurgissent dans un **rail Accueil**
      « Reprends où tu en étais » ainsi que dans la **palette ⌘K**. Logique pure et **testée**
      (`lib/recently-viewed.ts`), mise à jour live via un event ; i18n FR·EN·ES·DE·IT.
- [x] **Résilience & accessibilité (qualité/UX)** — un **ErrorBoundary** global affiche un repli
      localisé + rechargement au lieu d'un écran blanc quand une vue plante (la coque navbar/footer
      reste utilisable) ; un lien **« Aller au contenu »** (skip-link) pour le clavier/lecteurs
      d'écran ; et le respect de **`prefers-reduced-motion`** (animations/transitions/scroll coupés).

## ✅ Phase 8 — Disjoncteur, insights & feedback (LIVRÉ)

Trois axes d'amélioration majeurs, toujours sans dépendance ni infra externe :

- [x] **Disjoncteur (circuit breaker) TMDB (perf & résilience backend)** — au-delà du
      cache LRU+TTL et du single-flight, une **machine à états** ouvre le circuit après une série
      d'échecs amont (réseau/timeout/5xx/retries épuisés) : les appels suivants **échouent vite**
      (cache périmé servi si dispo, sinon 503 immédiat) au lieu de vider le budget de retry sur un
      TMDB mort. Passage en **half-open** après cooldown avec une requête sonde ; un succès referme,
      un échec rouvre. Les **erreurs client 4xx ne font jamais sauter le disjoncteur**. Module isolé
      et testé (`backend/circuit-breaker.js`), métriques (`state`/`trips`/`shortCircuits`…) exposées
      dans `/api/health`.
- [x] **Statistiques de la bibliothèque (feature)** — un panneau « Statistiques » repliable dans
      Ma liste calcule **localement** (sans compte, sans appel TMDB) : total, vus/à voir &
      progression, répartition films/séries, ta **note moyenne**, l'**histogramme de tes notes**
      (1→10) et tes **décennies de prédilection**. Logique pure et **testée**
      (`project/src/lib/library-stats.ts`), i18n FR·EN·ES·DE·IT.
- [x] **Notifications toast accessibles (qualité/UX)** — les actions silencieuses (ajout/retrait,
      import/export, vidage) donnent désormais un retour clair via un système de toasts : **région
      `aria-live`** toujours montée (annonce lecteur d'écran), `role="alert"` pour les erreurs,
      auto-dismiss, dédup, file bornée, et animations qui respectent `prefers-reduced-motion`. Cœur
      pur et **testé** (`project/src/lib/toast.ts`).

## ✅ Phase 9 — Séries, démarrage à chaud & images responsives (LIVRÉ)

Trois axes d'amélioration majeurs, toujours sans dépendance ni infra externe :

- [x] **Saisons & épisodes des séries (feature)** — la fiche d'une série expose désormais un
      **navigateur saison par saison** : sélecteur de saisons (spéciaux relégués en fin), puis la
      **liste des épisodes** (vignette, code SxEx, titre, date de diffusion, durée, note) chargée
      **à la demande** et mise en cache côté composant (aucun re-fetch en changeant d'onglet). Backend :
      endpoint `GET /api/tv/:id/season/:season` + index des saisons dans la fiche, normaliseurs purs et
      **testés** (`backend/tmdb-seasons.test.js`) ; frontend : `SeasonBrowser`, helper pur `lib/seasons.ts`
      **testé**, i18n FR·EN·ES·DE·IT.
- [x] **Persistance du cache & arrêt gracieux (perf & résilience backend)** — au redémarrage/redéploiement,
      le cache TMDB ne repart plus **à froid** : sur un `SIGTERM`/`SIGINT`, le serveur **cesse d'accepter**,
      laisse les requêtes en vol se terminer, **snapshote le cache sur disque** (écriture atomique, même
      `DATA_DIR` que le store) puis sort ; au boot il **réhydrate** les entrées encore fraîches (le `storedAt`
      d'origine est conservé, les entrées périmées sont écartées, le cap LRU respecté). Protège TMDB du
      thundering-herd post-déploiement. Cœur `snapshot()`/`hydrate()` pur et **testé** (`backend/cache.test.js`) ;
      un timeout d'arrêt dur garantit qu'on ne bloque jamais l'orchestrateur.
- [x] **Livraison d'images responsives (perf/UX)** — un builder pur `lib/img.ts` dérive un **`srcset`**
      côté client à partir de l'URL TMDB unique renvoyée par l'API (le navigateur choisit la résolution
      selon le viewport et le DPR). Appliqué aux **posters** (grilles, recommandations, fiche), aux
      **backdrops** (hero, fiche) et aux **vignettes d'épisodes**, avec `decoding="async"`. Une grille de
      posters sur mobile ne télécharge plus une image `w500` pour l'afficher à ~150 px : bande passante en
      moins, meilleur LCP, **contrat d'API inchangé**. Logique pure et **testée** (`project/src/lib/img.test.ts`).

## ✅ Phase 10 — Prêt à publier : packaging de prod & durcissement (LIVRÉ)

Le code applicatif était mûr, mais le repo n'était pas *publiable* : il se déployait sur un
serveur de dev, tolérait un secret d'authentification par défaut, et n'avait ni licence ni
vitrine. Cette phase traite l'écart entre « ça marche » et « ça se montre ».

- [x] **Image frontend de production** — le `Dockerfile` lançait `vite dev --host`, c'est-à-dire un
      serveur de développement en production (bundle non minifié, websocket HMR ouvert). Il est
      remplacé par un **multi-stage** : `npm ci` + `vite build`, puis **nginx** qui sert le statique.
      Assets hashés en `immutable` un an ; shell, service worker et manifeste en `no-cache` (sans
      quoi un redéploiement continuerait à servir la build précédente). Image finale sans Node ni
      sources. `.dockerignore` des deux côtés, backend en `node:20-alpine` + `npm ci --omit=dev`,
      utilisateur **non-root**, et `HEALTHCHECK` sur les deux services.
- [x] **API en même-origine** — nginx **proxifie `/api`** vers le backend sur le réseau interne. Le
      navigateur ne fait plus d'appel cross-origin (plus de CORS), l'URL de l'API n'est plus gravée
      dans le bundle, et le backend **n'expose plus aucun port publiquement** : un seul port à mettre
      derrière TLS. Côté client, `VITE_API_URL` vide bascule en relatif (`??` au lieu de `||`, pour
      qu'une chaîne vide reste une chaîne vide) ; non défini, le défaut dev `localhost:3001` tient.
- [x] **Secret JWT obligatoire en production** — `auth.js` retombait sur un secret écrit en clair
      dans le fichier, avec un simple `console.warn` : n'importe qui pouvait forger un jeton pour
      n'importe quel compte. L'API **refuse désormais de démarrer** si `NODE_ENV=production` et
      `JWT_SECRET` absent, et `docker compose` échoue avant même de construire (plus de valeur par
      défaut partagée dans le compose — elle aurait satisfait la garde tout en restant publique).
      Règle extraite en `assertSecretConfigured()` et **testée**, avec `requireAuth` (jeton forgé,
      jeton expiré, jeton absent) : `backend/auth.test.js`, +8 tests → **142 verts**.
- [x] **`robots.txt` / `sitemap.xml` suivent le domaine réel** — ils pointaient en dur vers
      `https://neox.app`. Un script `postbuild` les réécrit depuis `VITE_SITE_URL`, la même variable
      qui pilote déjà les URLs canoniques et Open Graph. Non définie, le placeholder reste et la
      build passe.
- [x] **Licence & vitrine** — **LICENSE MIT** ajoutée (sans licence, un repo public reste « tous
      droits réservés »), badges CI/licence/tests, section sécurité dans le README, et une galerie
      de captures prête à décommenter (spécifications de prise de vue dans
      `docs/screenshots/README.md`).

## ⏭️ Reste

### 🔴 À faire avant de rendre le repo public

- [x] **Historique purgé.** Le `.env` commité avant le pivot a été retiré de l'intégralité de
      l'historique (`git filter-repo`), ainsi que les 12 fichiers `.idea/` de config JetBrains.
      Les 78 commits et leurs dates d'auteur sont conservés à l'identique. La clé qui y vivait est
      à considérer comme compromise et doit être révoquée côté fournisseur, indépendamment de
      cette purge.
- [ ] **Déployer et renseigner l'URL de démo** dans le README (le lien est un `#` en attendant).
- [x] **Captures d'écran déposées** — les 5 vues spécifiées dans `docs/screenshots/README.md`,
      en 1440×900, thème sombre, PNG < 400 Ko chacune. Galerie active dans le README.

### 🟡 Nécessite une infra externe (volontairement non codé en dur)

- [ ] **Notifications « ça arrive sur ta plateforme »** — requiert SMTP/push + un scheduler
      (cron) + détection de changement de dispo. À brancher quand l'infra mail/push est choisie.
- [ ] **Cache partagé (Redis)** — pour le scaling multi-instances (le cache actuel est borné en
      mémoire par instance — voir Phase 4).
- [ ] **SEO complet des fiches** — SSR/prerender (Next.js ou vite-plugin-ssr) ; les deep links
      fonctionnent déjà côté client.
