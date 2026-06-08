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

## 📈 Phase 3 — Croissance (ce mois)

- [ ] **Recommandations perso** basées sur la watchlist (TMDB `recommendations` agrégées).
- [ ] **Notifications « ça arrive sur ta plateforme »** (digest e-mail/push).
- [ ] **Personnes** (acteurs/réalisateurs) : filmographie cliquable depuis le casting.
- [ ] **PWA** installable + offline shell.
- [ ] **i18n** (region/langue dynamiques côté UI, déjà paramétrables côté API).
- [ ] **Analytics produit** (Plausible) sur recherche, ouverture fiche, ajout watchlist.

## 🛡️ Tech debt / durcissement

- [ ] Tests : Vitest (hooks/lib) + supertest (routes API).
- [ ] Rate-limit + `helmet` + `compression` côté Express.
- [ ] Cache partagé (Redis) si multi-instances.
- [ ] CI : lint + typecheck + build sur PR.
- [ ] **Faire tourner la clé du fournisseur** présente dans l'historique git (compromise) et purger
      l'historique si le repo doit devenir public (`git filter-repo`).
