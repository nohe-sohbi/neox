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
- **Explorer** — filtres par genre, tri (populaires, mieux notés, récents, box-office) et
  **scroll infini**.
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
- **Cache HTTP** — en plus du cache mémoire, les endpoints de lecture envoient `Cache-Control`
  (`max-age` + `stale-while-revalidate`) et des **ETags forts** → navigateurs et CDN réutilisent les
  réponses et obtiennent des **304** quand rien n'a changé ; les routes privées sont en `no-store`.
- **Accessibilité des modales** — fiche, personne, auth et palette ⌘K partagent un hook
  `useModal` : **piège de focus**, restauration du focus à la fermeture, `Escape`, verrou de scroll
  et sémantique `role="dialog"` / `aria-modal`.
- **Design system** Tailwind sur-mesure : thème sombre, dégradé de marque, micro-interactions,
  skeletons, responsive mobile-first.

## 🏗️ Architecture

```
neox/
├── backend/            API Node/Express — proxy TMDB + comptes + sync
│   ├── server.js       routes + validation + gestion d'erreurs centralisée
│   ├── tmdb.js         client TMDB (retry/backoff, normalisation)
│   ├── cache.js        cache borné LRU + TTL + stale-while-revalidate (testé)
│   ├── http-cache.js   middlewares Cache-Control + ETag/304 + no-store (testé)
│   ├── auth.js         bcrypt + JWT, middleware requireAuth
│   ├── store.js        store JSON persistant (atomique, zéro dépendance)
│   └── library.js      validation + merge des bibliothèques
└── project/            Frontend React + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/        client API typé · i18n (FR/EN/ES/DE/IT) · recherches récentes · library-io (export/import + tri)
        ├── context/    AuthContext · LibraryContext (sync cloud)
        ├── hooks/      useDebounce · useMyPlatforms · useDetailRoute · useModal (focus trap a11y)
        ├── components/ layout · media · home · auth · ui · command (⌘K)
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
| GET | `/api/discover/:type?genre=&sort=&page=` | Exploration filtrée |
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

- **Tests** : `npm test` côté `backend/` (auth + sync via supertest, cache HTTP : headers + 304) et
  `project/` (logique bibliothèque + export/import/tri, i18n via vitest).
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
