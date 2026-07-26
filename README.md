<div align="center">

# NEOX

### Ton radar cinéma & séries.

Découvre les tendances, lance la bande-annonce, et sache tout de suite où regarder, légalement.

React + TypeScript + Vite · Node + Express · TMDB API

[![CI](https://github.com/nohe-sohbi/neox/actions/workflows/ci.yml/badge.svg)](https://github.com/nohe-sohbi/neox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-3b82f6.svg)](LICENSE)

**[Démo live → neox.sohbi.dev](https://neox.sohbi.dev)**

</div>

<div align="center">

|  |  |
|---|---|
| ![Accueil](docs/screenshots/home.png) | ![Fiche détaillée](docs/screenshots/detail.png) |
| **Accueil** : hero + rails éditorialisés | **Fiche** : où regarder, en streaming, location ou achat |
| ![Explorer](docs/screenshots/discover.png) | ![Ma liste](docs/screenshots/library.png) |
| **Explorer** : filtres et scroll infini | **Ma liste** : notes et statistiques |
| ![Palette de commande](docs/screenshots/command.png) | |
| **Ctrl K** : recherche instantanée et navigation | |

</div>

---

## C'est quoi NEOX ?

Tu cherches une pépite à regarder ce soir. NEOX te montre les tendances du moment, te lance la
bande-annonce, et te dit sur quelles plateformes légales le titre est disponible dans ta région,
en streaming, en location ou à l'achat. Un clic sur le marque-page et c'est dans ta liste.

Aucun contenu n'est hébergé ni diffusé : NEOX agrège des métadonnées publiques (TMDB) et la
disponibilité légale (JustWatch via TMDB).

## Ce que ça fait

- **Découvrir** : accueil éditorialisé (hero rotatif, rails « À l'affiche », « Tendances séries »,
  « Acclamés par la critique »), recherche instantanée sur les films et les séries.
- **Savoir où regarder** : la section « Où regarder (légalement) » de chaque fiche liste le
  streaming, la location et l'achat pour ta région, avec un filtre « Mes plateformes » qui ne garde
  que tes services.
- **Explorer finement** : genre, année de sortie, note minimale (6+/7+/8+/9+), tri par popularité,
  note, date ou box-office, en scroll infini.
- **Naviguer au clavier** : palette `Ctrl K` globale pour chercher un titre, sauter vers une page ou
  reprendre une recherche récente, sans quitter le clavier.
- **Suivre ses séries** : navigateur par saison dans la fiche, liste des épisodes avec vignette,
  code `SxEx`, date, durée et note, chargée à la demande.
- **Tenir sa liste** : statut À voir / Vu, note personnelle de 1 à 10, tri, filtres, et un panneau
  de statistiques calculé localement (progression, répartition films/séries, note moyenne,
  histogramme des notes, décennies de prédilection).
- **Retrouver son NEOX partout** : compte optionnel (inscription, connexion) qui synchronise la
  bibliothèque *et* les préférences entre appareils : plateformes de streaming, région et langue du
  catalogue, tri et filtre par défaut de la liste. Sans compte, tout reste en local, avec export et
  import JSON.
- **Rester maître de son compte** : un panneau « Mon compte » pour changer son mot de passe,
  déconnecter les autres appareils, exporter l'intégralité de ses données en un fichier, et
  supprimer son compte pour de bon.
- **Installer l'app** : PWA avec shell hors-ligne et images en cache, interface traduite en
  français, anglais, espagnol, allemand et italien.

## Sous le capot

Ce qui n'est pas visible à l'écran mais tient l'app debout :

- **La clé TMDB ne quitte jamais le serveur.** Le frontend ne parle qu'à l'API NEOX, qui met en
  cache et normalise chaque réponse.
- **Trois couches contre les pannes amont.** Un cache LRU + TTL en `stale-while-revalidate` sert la
  donnée légèrement périmée plutôt qu'une erreur ; le coalescing (single-flight) réduit N
  cache-miss concurrents à un seul appel amont ; un disjoncteur ouvre le circuit après une série
  d'échecs et se referme via une requête sonde. Métriques et état exposés sur `/api/health`.
- **Redémarrage à chaud.** Sur `SIGTERM`, le serveur snapshote le cache TMDB sur disque et le
  réhydrate au boot : un redéploiement ne repart plus cache vide.
- **Cache HTTP.** Les endpoints de lecture envoient `Cache-Control` et des ETags forts, les routes
  privées sont en `no-store`.
- **Auth self-contained.** bcrypt + JWT + store JSON atomique, aucun SaaS tiers. L'API refuse de
  démarrer en production sans `JWT_SECRET`. Chaque jeton porte la génération du compte : changer son
  mot de passe ou demander une déconnexion globale incrémente ce compteur et invalide d'un coup tous
  les jetons émis avant, sans table de sessions à maintenir. La suppression d'un compte efface le
  compte, ses préférences et sa bibliothèque, et ses jetons cessent de passer à la requête suivante.
- **Sync sans écrasement.** La bibliothèque porte un numéro de révision : un `PUT` contre une
  révision périmée est refusé en `409` avec l'état du serveur, que le client fusionne avant de
  repousser. Sans ça, deux onglets ouverts suffisent à ce que le plus lent efface ce que l'autre
  vient d'enregistrer. En cas de conflit, l'union gagne : perdre une suppression est moins grave que
  perdre une collection.
- **Accessibilité.** Les quatre overlays partagent un hook `useModal` (piège de focus, restauration,
  `Escape`, verrou de scroll, `role="dialog"`), les actions passent par une région `aria-live`, il y
  a un skip-link. Contrastes mesurés, pas estimés : tout le texte passe le 4.5:1 de WCAG AA sur le
  fond `ink-950`. `prefers-reduced-motion` réduit les transitions à 80 ms et coupe les transformées
  au lieu de tout annuler : un bouton qui ne réagit plus du tout se lit comme cassé, pas comme calme.
- **Typographie auto-hébergée.** Bricolage Grotesque pour les titres, Instrument Sans pour
  l'interface, en variable woff2 servi par le bundle. Aucune requête vers un CDN de polices, ce qui
  serait incohérent pour une app qui ne charge même pas de script d'analytics par défaut.
- **Perf client.** Cache mémoire SWR avec dédup des requêtes en vol, `srcset` dérivé côté client des
  URLs TMDB, `ErrorBoundary` global au lieu d'un écran blanc.
- **L'interface n'a pas de couleur d'accent.** Elle emprunte celle du titre affiché : la teinte
  dominante de l'affiche est extraite dans le navigateur, pondérée par la saturation puis rendue
  comme de la lumière, et c'est elle qui colore le hero, la carte survolée et la fiche ouverte. Là où
  aucun titre n'est en contexte, comme la barre de navigation, l'état actif reste un blanc neutre.
  Coût : zéro travail serveur, `image.tmdb.org` répondant `access-control-allow-origin: *`, et un
  échantillon `w92` de quelques kilo-octets mis en cache un an.
- **SEO.** Le `<head>` suit la route et la fiche ouverte (`title`, `description`, Open Graph,
  Twitter Card, canonique), avec des données structurées schema.org : `WebSite` + `SearchAction` sur
  l'accueil, `Movie` ou `TVSeries` sur une fiche, `Person` sur un profil. `aggregateRating` n'est
  émis que si un vrai nombre de votes le porte, parce que Google rejette une note sans compteur.
  Les surfaces sans valeur de recherche (`/search`, `/library`) sont servies en `noindex` plutôt que
  bloquées dans `robots.txt` : une URL interdite au crawl ne fait jamais lire son `noindex`.
- **Analytics optionnelle et sans cookie.** Aucun script n'est chargé tant que
  `VITE_UMAMI_WEBSITE_ID` n'est pas défini. Quand elle est active, une instance
  [Umami](https://umami.is) auto-hébergée compte les pages et dix actions produit (`Open Detail`,
  `Trailer Play`, `Providers Click`, `Palette Open`, `Rating Set`, `Library Add`, `Library Import`,
  `Library Export`, `Signup`, `Login`). Aucune propriété d'événement ne porte de donnée personnelle :
  pas d'e-mail, pas de terme de recherche, seulement des compteurs et des types de média.
  `VITE_UMAMI_DOMAINS` limite le tracker au domaine de production, donc une session locale ne
  pollue pas les statistiques.

## Architecture

```
neox/
├── backend/            API Node/Express : proxy TMDB + comptes + sync
│   ├── server.js       routes, validation, gestion d'erreurs centralisée
│   ├── tmdb.js         client TMDB (retry/backoff, normalisation)
│   ├── cache.js        cache LRU + TTL + stale-while-revalidate + snapshot/hydrate
│   ├── single-flight.js coalescing des requêtes amont concurrentes
│   ├── circuit-breaker.js disjoncteur sur la santé de TMDB
│   ├── http-cache.js   middlewares Cache-Control, ETag/304, no-store
│   ├── auth.js         bcrypt + JWT (générations de jetons), middleware requireAuth
│   ├── store.js        store JSON persistant, atomique, zéro dépendance
│   ├── library.js      validation et merge des bibliothèques
│   └── preferences.js  validation des préférences de compte
└── project/            Frontend React + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/        client API typé, query (SWR + dédup), i18n, library-io, preferences, seo, structured-data, film-color, img
        ├── context/    AuthContext, PreferencesContext, LibraryContext
        ├── hooks/      useQuery, useDebounce, useMyPlatforms, useModal, useDocumentMeta, useFilmColor
        ├── components/ layout, media, home, auth, ui, command
        └── views/      Home, Discover, Search, Library
```

Bibliothèque et préférences sont localStorage-first, puis réconciliées avec le compte à la
connexion : la bibliothèque par fusion, les préférences en gardant le côté modifié le plus
récemment. Sans compte, rien ne change, tout vit dans le navigateur.

## Démarrage

### Prérequis
- Docker + Docker Compose, ou Node 20+
- Une clé API TMDB, gratuite : https://www.themoviedb.org/settings/api

### 1. Configurer
```bash
cp .env.example .env
# Renseigne TMDB_API_KEY, puis génère un secret de signature :
openssl rand -hex 32   # à coller dans JWT_SECRET
```

`docker compose` refuse de démarrer si `TMDB_API_KEY` ou `JWT_SECRET` manquent : un secret JWT par
défaut partagé permettrait à n'importe qui de forger un jeton pour n'importe quel compte.

### 2a. Lancer avec Docker (recommandé)
```bash
docker compose up --build
```
App sur http://localhost:8080, `WEB_PORT` pour changer de port.

Le stack est façonné pour la production : le frontend est buildé puis servi en statique par nginx
(assets hashés en cache long, shell et service worker en `no-cache`), et l'API est proxyfiée sous le
même domaine en `/api`. Le navigateur ne fait aucun appel cross-origin, le backend n'expose aucun
port publiquement, et il ne reste qu'un port à placer derrière ton terminateur TLS.

Pour un déploiement sur ton domaine, renseigne aussi `VITE_SITE_URL` : elle pilote les URLs
canoniques et Open Graph, et réécrit `robots.txt` + `sitemap.xml` au build.

> Vite inline ses variables au build, pas au démarrage du conteneur. Après avoir changé un `VITE_*`,
> reconstruis l'image (`docker compose up --build`).

### 2b. Lancer en local, sans Docker
Le mode à utiliser pour développer, avec hot-reload des deux côtés :
```bash
# Terminal 1, API
cd backend && npm install && npm run dev

# Terminal 2, frontend
cd project && npm install && npm run dev
```
Frontend sur http://localhost:5173, API sur http://localhost:3001.

Sans `VITE_API_URL`, le frontend vise `http://localhost:3001`. Le mettre à la chaîne vide bascule en
même-origine (`/api`), ce que fait l'image Docker.

## API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | État du service, config TMDB, métriques cache et disjoncteur |
| GET | `/api/home` | Payload accueil (hero + rails) |
| GET | `/api/search?q=&page=` | Recherche multi (films + séries) |
| GET | `/api/trending/:type?window=week\|day` | Tendances (`all`/`movie`/`tv`) |
| GET | `/api/discover/:type?genre=&sort=&year=&minRating=&page=` | Exploration filtrée |
| GET | `/api/genres/:type` | Genres (`movie`/`tv`) |
| GET | `/api/providers/:type?region=` | Plateformes de streaming d'une région |
| GET | `/api/person/:id` | Profil et filmographie d'une personne |
| POST | `/api/recommendations` | « Pour toi » à partir de `{ seeds: [...] }` |
| GET | `/api/:type/:id` | Fiche complète, providers, casting, reco, saisons pour `tv` |
| GET | `/api/tv/:id/season/:season` | Épisodes d'une saison |
| POST | `/api/auth/register` | Création de compte, renvoie `{ token, user }` |
| POST | `/api/auth/login` | Connexion, renvoie `{ token, user }` |
| GET | `/api/auth/me` 🔒 | Profil du token courant |
| PATCH | `/api/account/password` 🔒 | Change le mot de passe, révoque les autres sessions |
| POST | `/api/account/logout-all` 🔒 | Déconnecte tous les autres appareils |
| GET | `/api/account/export` 🔒 | Compte + préférences + bibliothèque en un document |
| DELETE | `/api/account` 🔒 | Supprime le compte et ses données (mot de passe requis) |
| GET | `/api/preferences` 🔒 | Préférences du compte (`null` si jamais enregistrées) |
| PUT | `/api/preferences` 🔒 | Met à jour les préférences (patch partiel) |
| GET | `/api/library` 🔒 | Bibliothèque du compte, avec sa révision |
| PUT | `/api/library` 🔒 | Remplace la bibliothèque (`409` si `rev` est périmée) |
| POST | `/api/library/merge` 🔒 | Fusionne local et serveur |

🔒 requiert l'en-tête `Authorization: Bearer <token>`.
Les endpoints TMDB acceptent `?region=` et `?lang=` pour localiser résultats et disponibilités.

## Qualité

- **210 tests** : 96 côté `backend/` (auth, gestion de compte et sync via supertest, révocation de
  jetons, conflits de révision, validation des préférences, garde du secret JWT, cache HTTP, cache
  LRU et snapshot/hydrate, single-flight, params discover, saisons) et 114 côté `project/`
  (bibliothèque, préférences, export/import, i18n, SEO, données structurées, extraction de teinte,
  cache SWR, vu récemment, srcset).
- **Vérifs** : `npm run lint`, `npm run typecheck`, `npm run build`.
- **CI** : GitHub Actions lance lint, typecheck, tests et build sur chaque PR
  (`.github/workflows/ci.yml`).

## Sécurité

- La clé TMDB ne quitte jamais le serveur.
- Aucun secret versionné : `.env` est ignoré, seul `.env.example` est suivi.
- L'API refuse de démarrer en `NODE_ENV=production` sans `JWT_SECRET` : un secret de repli connu de
  tous vaut une absence d'authentification.
- Mots de passe hachés bcrypt, jetons JWT signés, `helmet`, rate-limit global et limiteur strict sur
  `/api/auth` et `/api/account`, corps de requête bornés.
- Les jetons sont révocables malgré leur nature stateless : un compteur de génération par compte,
  incrémenté au changement de mot de passe et à la déconnexion globale, invalide instantanément tous
  les jetons plus anciens. Un jeton d'un compte supprimé ne passe plus.
- Changer son mot de passe et supprimer son compte redemandent le mot de passe courant : un jeton
  valide prouve la session, pas la personne devant l'appareil.
- Les routes privées (`/api/library`, `/api/preferences`, `/api/account`, `/api/auth/me`) sont en
  `no-store`, jamais mises en cache par un navigateur ou un CDN.

## Stack

**Frontend** : React 18 · TypeScript · Vite · Tailwind CSS · lucide-react · Bricolage Grotesque + Instrument Sans
**Backend** : Node 20 · Express · node-fetch · cache en mémoire
**Déploiement** : Docker multi-stage · nginx (statique + proxy `/api`)
**Données** : [TMDB](https://www.themoviedb.org/) · disponibilité via JustWatch

## Licence et mentions

Publié sous licence **[MIT](LICENSE)**.

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
NEOX n'héberge, ne stocke et ne diffuse aucun contenu vidéo.
