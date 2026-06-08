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

- **Accueil éditorialisé** — hero rotatif + rails « À l'affiche », « Tendances séries »,
  « Acclamés par la critique »…
- **Recherche instantanée** (debounced, films + séries) avec états loading / vide / erreur soignés.
- **Explorer** — filtres par genre, tri (populaires, mieux notés, récents, box-office) et
  **scroll infini**.
- **Fiche détaillée** — bande-annonce YouTube intégrée, synopsis, casting, genres, durée, et la
  section **« Où regarder (légalement) »**.
- **Ma liste** — watchlist persistante (localStorage), synchronisée entre onglets.
- **Design system** Tailwind sur-mesure : thème sombre, dégradé de marque, micro-interactions,
  skeletons, responsive mobile-first.

## 🏗️ Architecture

```
neox/
├── backend/            API Node/Express — proxy TMDB caché et normalisé
│   ├── server.js       routes + validation + gestion d'erreurs centralisée
│   └── tmdb.js         client TMDB (cache TTL, retry/backoff, normalisation)
└── project/            Frontend React + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/        client API typé + types partagés
        ├── hooks/      useDebounce, useWatchlist
        ├── components/ layout · media · home · ui
        └── views/      Home · Discover · Search · Watchlist
```

La clé TMDB **reste côté serveur** : le frontend ne parle qu'à l'API NEOX, qui met en cache et
normalise chaque réponse pour rester rapide et sous les limites de débit.

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
| GET | `/api/:type/:id` | Fiche complète + providers + casting + reco |

## 🧰 Stack

**Frontend** : React 18 · TypeScript · Vite · Tailwind CSS · lucide-react
**Backend** : Node 20 · Express · node-fetch · cache en mémoire
**Données** : [TMDB](https://www.themoviedb.org/) · disponibilité via JustWatch

## 📄 Mentions

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
NEOX n'héberge, ne stocke et ne diffuse aucun contenu vidéo.
