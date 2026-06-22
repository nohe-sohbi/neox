<div align="center">

# 🎬 NEOX

### Ton radar cinéma & séries.

**Découvre les tendances. Regarde les bandes-annonces. Trouve où regarder — légalement.**

React + TypeScript + Vite · Node + Express · TMDB API

</div>

---

## C'est quoi NEOX ?

NEOX est une app de **découverte de films et séries**. Tu cherches une pépite à regarder ce
soir, NEOX te montre les tendances du moment, te lance la bande-annonce, et te dit
**instantanément sur quelles plateformes légales** le titre est dispo (streaming, location,
achat) dans ta région. Un clic sur le marque-page et c'est dans ta watchlist.

Aucun contenu n'est hébergé ni stocké : NEOX agrège des **métadonnées publiques** (TMDB) et la
**disponibilité légale** (JustWatch via TMDB).

## ✨ Fonctionnalités

- **Accueil éditorialisé** — hero rotatif (avec préchargement des backdrops) + rails
  « À l'affiche », « Tendances séries », « Acclamés par la critique »…
- **Recherche instantanée** (debounced, films + séries) avec états loading / vide / erreur soignés.
- **Palette de commandes ⌘K** — lanceur clavier global (⌘K / Ctrl+K) : recherche instantanée, saut
  vers n'importe quelle page et **recherches récentes**, navigation 100 % clavier.
- **Explorer** — filtres par genre, **année de sortie**, **note minimale** (6+/7+/8+/9+), tri
  (populaires, mieux notés, récents, box-office) et **scroll infini**.
- **Filtre « Mes plateformes »** — n'affiche que ce qui est dispo sur tes services (Netflix,
  Prime, Max…), préférence mémorisée.
- **Fiche détaillée** — bande-annonce YouTube intégrée, synopsis, casting, genres, durée, et la
  section **« Où regarder (légalement) »**.
- **Bibliothèque perso** — statut **À voir / Vu**, **note personnelle 1–10**, filtres par statut,
  **tri** (ajout, titre, note TMDB, ta note, année) et **export / import JSON** (sauvegarde et
  restauration portables, sans compte requis).
- **Comptes & sync cloud** — inscription/connexion (JWT), ta liste fusionnée et synchronisée sur
  tous tes appareils. Hors-ligne : tout reste en localStorage.
- **Recommandations « Pour toi »** — suggestions personnalisées à partir de ta bibliothèque.
- **Pages Personnes** — casting cliquable → bio + filmographie de l'acteur·rice.
- **Interface multilingue (i18n)** — toute l'UI est traduite (FR · EN · ES · DE · IT) et suit le
  sélecteur région/langue, en plus du catalogue déjà localisé par TMDB.
- **PWA installable** — ajoute NEOX à ton écran d'accueil, shell offline, images en cache.
- **URLs partageables** — chaque fiche a son deep link (`/?watch=movie-550`), navigation par routes.
- **Analytics privacy-first** (Plausible, opt-in) et **API durcie** (helmet, compression, rate-limit).
- **Cache TMDB résilient** — cache borné **LRU + TTL** avec **stale-while-revalidate** (une panne
  TMDB sert la donnée en cache plutôt qu'une erreur) ; métriques exposées sur `/api/health`.
- **Coalescing de requêtes (single-flight)** — les **cache-miss concurrents** sur une même URL TMDB
  ne déclenchent qu'**un seul appel amont** (le premier appelant travaille, les autres attendent la
  même promesse) : protection thundering-herd, quota TMDB préservé sous charge. Compteurs
  `coalesced` / `flights` / `inFlight` exposés sur `/api/health`.
- **Disjoncteur (circuit breaker) TMDB** — après une série d'échecs amont, le circuit s'**ouvre** et
  les appels suivants **échouent vite** (cache périmé servi si dispo, sinon 503 immédiat) plutôt que
  de vider le budget de retry sur un TMDB en panne ; **half-open** + requête sonde après cooldown
  pour se refermer automatiquement. Les erreurs client 4xx ne le déclenchent jamais. État et
  compteurs (`state` / `trips` / `shortCircuits`…) exposés sur `/api/health`.
- **Statistiques de la bibliothèque** — un panneau « Statistiques » repliable dans Ma liste calcule
  **localement** ta progression (vus/à voir), la répartition films/séries, ta **note moyenne**,
  l'**histogramme de tes notes** et tes **décennies de prédilection** — sans compte ni appel TMDB.
- **Notifications toast accessibles** — chaque action (ajout/retrait, import/export, vidage) donne un
  retour clair via une **région `aria-live`** (annoncée aux lecteurs d'écran, `role="alert"` pour les
  erreurs), avec auto-dismiss et respect de `prefers-reduced-motion`.
- **SEO dynamique & cartes sociales** — chaque route et chaque fiche/personne pilote le `<head>`
  (`title`, `description`, **Open Graph + Twitter Card** avec poster, URL canonique) ; les overlays
  restaurent le head à la fermeture. `robots.txt` + `sitemap.xml` inclus.
- **Cache HTTP** — en plus du cache mémoire, les endpoints de lecture envoient `Cache-Control`
  (`max-age` + `stale-while-revalidate`) et des **ETags forts** → navigateurs et CDN réutilisent les
  réponses et obtiennent des **304** quand rien n'a changé ; les routes privées sont en `no-store`.
- **Accessibilité des modales** — fiche, personne, auth et palette ⌘K partagent un hook
  `useModal` : **piège de focus**, restauration du focus à la fermeture, `Escape`, verrou de scroll
  et sémantique `role="dialog"` / `aria-modal`.
- **Cache de données côté client** — cache mémoire **stale-while-revalidate** avec **dédup des
  requêtes en vol** (`lib/query.ts` + `useQuery`) : revenir sur l'Accueil ou changer d'onglet
  repeint instantanément depuis le cache puis revalide en arrière-plan, sans skeleton qui clignote.
- **« Vu récemment »** — les fiches ouvertes sont mémorisées localement et resurgissent dans un rail
  Accueil « Reprends où tu en étais » et dans la palette ⌘K (sans compte requis).
- **Résilience & a11y** — **ErrorBoundary** global (repli localisé + rechargement plutôt qu'un écran
  blanc), lien **« Aller au contenu »** (skip-link) et respect de **`prefers-reduced-motion`**.
- **Design system** Tailwind sur-mesure : thème sombre, dégradé de marque, micro-interactions,
  skeletons, responsive mobile-first.

## 🏗️ Architecture

```
neox/
├── backend/            API Node/Express — proxy TMDB + comptes + sync
│   ├── server.js       routes + validation + gestion d'erreurs centralisée
│   ├── tmdb.js         client TMDB (retry/backoff, normalisation)
│   ├── cache.js        cache borné LRU + TTL + stale-while-revalidate (testé)
│   ├── single-flight.js coalescing des requêtes amont concurrentes (testé)
│   ├── http-cache.js   middlewares Cache-Control + ETag/304 + no-store (testé)
│   ├── auth.js         bcrypt + JWT, middleware requireAuth
│   ├── store.js        store JSON persistant (atomique, zéro dépendance)
│   └── library.js      validation + merge des bibliothèques
└── project/            Frontend React + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/        client API typé · query (cache SWR + dédup) · i18n (FR/EN/ES/DE/IT) · recherches récentes · recently-viewed · library-io (export/import + tri) · seo (meta/OG)
        ├── context/    AuthContext · LibraryContext (sync cloud)
        ├── hooks/      useDebounce · useQuery (SWR) · useMyPlatforms · useDetailRoute · useModal (focus trap a11y) · useDocumentMeta (SEO)
        ├── components/ layout · media · home · auth · ui (+ ErrorBoundary) · command (⌘K)
        └── views/      Home · Discover · Search · Library
```

La clé TMDB **reste côté serveur** : le frontend ne parle qu'à l'API NEOX, qui met en cache et
normalise chaque réponse. L'auth est **self-contained** (bcrypt + JWT, store JSON) — aucun SaaS
tiers requis. La bibliothèque est **localStorage-first** puis fusionnée au compte à la connexion.

## 🚀 Démarrage

### Prérequis
- Docker + Docker Compose **ou** Node 20+
- Une clé API TMDB (gratuite) : https://www.themoviedb.org/settings/api

### 1. Configurer
```bash
cp .env.example .env
# Renseigne TMDB_API_KEY dans .env
```

### 2a. Lancer avec Docker (recommandé)
```bash
docker compose up --build
```
- Frontend : http://localhost:5173
- API : http://localhost:3001

> Derrière un reverse proxy (Dokploy, Traefik…), retire le bloc `ports` du backend dans
> `docker-compose.yml` et route via le proxy.

### 2b. Lancer en local (sans Docker)
```bash
# Terminal 1 — API
cd backend && npm install && npm run dev

# Terminal 2 — Frontend
cd project && npm install && npm run dev
```

## 🔌 API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | État du service + config TMDB |
| GET | `/api/home` | Payload accueil (hero + rails) |
| GET | `/api/search?q=&page=` | Recherche multi (films + séries) |
| GET | `/api/trending/:type?window=week\|day` | Tendances (`all`/`movie`/`tv`) |
| GET | `/api/discover/:type?genre=&sort=&year=&minRating=&page=` | Exploration filtrée (genre, année, note min., tri) |
| GET | `/api/genres/:type` | Genres (`movie`/`tv`) |
| GET | `/api/providers/:type?region=` | Plateformes de streaming d'une région |
| GET | `/api/person/:id` | Profil + filmographie d'une personne |
| POST | `/api/recommendations` | « Pour toi » à partir de `{ seeds: [...] }` |
| GET | `/api/:type/:id` | Fiche complète + providers + casting + reco |
| POST | `/api/auth/register` | Création de compte → `{ token, user }` |
| POST | `/api/auth/login` | Connexion → `{ token, user }` |
| GET | `/api/auth/me` 🔒 | Profil du token courant |
| GET | `/api/library` 🔒 | Bibliothèque du compte |
| PUT | `/api/library` 🔒 | Remplace la bibliothèque |
| POST | `/api/library/merge` 🔒 | Fusionne (local ⊕ serveur) |

🔒 = requiert l'en-tête `Authorization: Bearer <token>`.
Les endpoints TMDB acceptent `?region=` et `?lang=` pour localiser résultats et disponibilités.

## ✅ Qualité

- **Tests** : `npm test` côté `backend/` (auth + sync via supertest, cache HTTP : headers + 304,
  cache LRU, **single-flight**, **params discover**) et `project/` (logique bibliothèque +
  export/import/tri, i18n, **SEO/meta**, **cache SWR + dédup**, **« vu récemment »** via vitest) —
  34 + 50 tests verts.
- **Vérifs** : `npm run lint` · `npm run typecheck` · `npm run build`.
- **CI** : GitHub Actions lance lint + typecheck + tests + build sur chaque PR
  (`.github/workflows/ci.yml`).

## 🧰 Stack

**Frontend** : React 18 · TypeScript · Vite · Tailwind CSS · lucide-react
**Backend** : Node 20 · Express · node-fetch · cache en mémoire
**Données** : [TMDB](https://www.themoviedb.org/) · disponibilité via JustWatch

## 📄 Mentions

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
NEOX n'héberge, ne stocke et ne diffuse aucun contenu vidéo.
