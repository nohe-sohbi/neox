# Roadmap

Où en est NEOX, et ce qui reste. L'app est fonctionnelle et déployable ; le détail de chaque
mécanisme est dans le README, section « Sous le capot ».

## Fait

**Produit.** Accueil éditorialisé (hero avec pause, rails, « Tendances » aujourd'hui / cette
semaine), recherche instantanée films, séries et personnes avec pagination en scroll, Explorer
avec filtres genre / année / note minimale portés par l'URL, compteur de résultats, scroll infini
et « Surprends-moi », fiche détaillée avec bande-annonce, casting, disponibilité légale et bouton
Partager — rouverte instantanément grâce au cache SWR —, navigateur saison par saison navigable au
clavier avec épisodes cochables et progression, pages Personnes, recommandations « Pour toi »,
palette `Ctrl K`, rail « Reprends où tu en étais », langue de l'interface auto-détectée au premier
lancement, bandeau hors-ligne.

**Bibliothèque.** Statut À voir / En cours / Vu, épisodes vus par série, note personnelle 1 à 10,
tri, filtres par statut et par type, recherche texte insensible aux accents, export JSON
réimportable et export CSV sans compte, panneau de statistiques calculé localement (dont la note
TMDB moyenne et l'écart avec tes notes). Comptes optionnels (bcrypt + JWT, store JSON) avec fusion
localStorage vers compte à la connexion, changement de mot de passe (qui révoque les jetons émis)
et suppression de compte.

**Interface.** Aucune couleur d'accent déclarée : la teinte vient de l'affiche du titre affiché,
extraite dans le navigateur et rendue comme de la lumière. Design system Tailwind sur-mesure en
thème sombre, typographie auto-hébergée
(Bricolage Grotesque pour les titres, Instrument Sans pour l'interface), i18n complète FR / EN / ES /
DE / IT, PWA installable avec shell hors-ligne, images responsives via `srcset` dérivé côté client,
toasts accessibles en région `aria-live`, piège de focus partagé par les quatre overlays, skip-link,
contrastes mesurés au niveau AA, `prefers-reduced-motion` qui raccourcit sans supprimer le retour
d'état, `ErrorBoundary` global.

**Résilience backend.** Cache LRU + TTL en stale-while-revalidate, coalescing des cache-miss
concurrents (single-flight), disjoncteur sur la santé de TMDB avec sonde en half-open, snapshot du
cache au `SIGTERM` et réhydratation au boot, arrêt gracieux avec timeout dur. Métriques et état
exposés sur `/api/health`.

**Perf.** Cache HTTP (`Cache-Control` + ETags forts, `no-store` sur les routes privées), cache
client SWR avec dédup des requêtes en vol.

**SEO.** `<head>` dynamique par route et par fiche, données structurées schema.org (`WebSite` +
`SearchAction`, `Movie`, `TVSeries`, `Person`), image de partage 1200 × 630 en PNG, `noindex` sur
`/search` et `/library`, `robots.txt` / `sitemap.xml` / tags statiques d'`index.html` réécrits au
build depuis `VITE_SITE_URL`.

**Packaging.** Image frontend multi-stage (`vite build` puis nginx), API proxyfiée en même-origine
sous `/api`, conteneurs non-root avec `HEALTHCHECK`, `JWT_SECRET` obligatoire en production,
licence MIT, 260 tests unitaires et d'intégration, un scénario Playwright de bout en bout (`e2e/`,
38 vérifications contre un TMDB factice) et CI GitHub Actions sur chaque PR.

## Reste

### Avant de rendre le repo public

- [x] **Historique purgé.** Le `.env` commité avant le pivot a été retiré de l'intégralité de
      l'historique (`git filter-repo`), avec les 12 fichiers `.idea/` de config JetBrains. Les 78
      commits et leurs dates d'auteur sont conservés à l'identique. La clé qui y vivait est à
      considérer comme compromise et doit être révoquée côté fournisseur, indépendamment de cette
      purge.
- [x] **Captures d'écran déposées.** Les 5 vues spécifiées dans `docs/screenshots/README.md`, en
      1440 × 900, thème sombre, PNG sous 400 Ko chacune. Galerie active dans le README.
- [x] **Déployé sur https://neox.sohbi.dev**, derrière Traefik avec un certificat Let's Encrypt.
      La stack compose tourne telle quelle : nginx sert le bundle et proxifie `/api` vers le
      backend, qui n'expose aucun port publiquement. Chaque `git push` sur `main` redéploie.

### Nécessite une infra externe, volontairement non codé en dur

- [ ] **Notifications « ça arrive sur ta plateforme ».** Demande SMTP ou push, un scheduler, et la
      détection d'un changement de disponibilité. À brancher quand l'infra mail est choisie.
- [ ] **Cache partagé (Redis)** pour le scaling multi-instances. Le cache actuel est borné en
      mémoire, par instance.
- [ ] **Rendu serveur des fiches.** Le `<head>` et le JSON-LD sont pilotés par route et par fiche,
      mais le rendu reste client-side : il manque du SSR ou du prerender pour les crawlers qui
      n'exécutent pas JS, et les fiches vivent sur un paramètre de requête (`/?watch=movie-550`)
      plutôt que sur un chemin propre. Chantier de framework, à ne lancer qu'avec une demande
      mesurée en face.
