# 🗺️ NEOX — Roadmap to Ship

Statut : **v1 livrable** (ce commit). Pivot d'un agrégateur illégal vers une app de
découverte légale (TMDB + « où regarder »). Ci-dessous : ce qui est fait, et la suite, en
étapes brutes et directes.

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

## ⏭️ Reste (nécessite une infra externe — volontairement non codé en dur)

- [ ] **Notifications « ça arrive sur ta plateforme »** — requiert SMTP/push + un scheduler
      (cron) + détection de changement de dispo. À brancher quand l'infra mail/push est choisie.
- [ ] **Cache partagé (Redis)** — pour le scaling multi-instances (le cache actuel est borné en
      mémoire par instance — voir Phase 4).
- [ ] **SEO complet des fiches** — SSR/prerender (Next.js ou vite-plugin-ssr) ; les deep links
      fonctionnent déjà côté client.
- [ ] **Sécurité** : faire tourner la clé du fournisseur présente dans l'historique git et purger
      l'historique si le repo devient public (`git filter-repo`).
