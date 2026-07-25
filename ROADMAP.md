# Roadmap

Où en est NEOX, et ce qui reste. L'app est fonctionnelle et déployable ; le détail de chaque
mécanisme est dans le README, section « Sous le capot ».

## Fait

**Produit.** Accueil éditorialisé (hero, rails), recherche instantanée films et séries, Explorer
avec filtres genre / année / note minimale et scroll infini, fiche détaillée avec bande-annonce,
casting et disponibilité légale, navigateur saison par saison pour les séries, pages Personnes,
recommandations « Pour toi », palette `Ctrl K`, rail « Reprends où tu en étais ».

**Bibliothèque.** Statut À voir / Vu, note personnelle 1 à 10, tri, filtres, export et import JSON
sans compte, panneau de statistiques calculé localement. Comptes optionnels (bcrypt + JWT, store
JSON) avec fusion localStorage vers compte à la connexion.

**Interface.** Design system Tailwind sur-mesure en thème sombre, i18n complète FR / EN / ES / DE /
IT, PWA installable avec shell hors-ligne, images responsives via `srcset` dérivé côté client,
toasts accessibles en région `aria-live`, piège de focus partagé par les quatre overlays,
skip-link, `prefers-reduced-motion` respecté, `ErrorBoundary` global.

**Résilience backend.** Cache LRU + TTL en stale-while-revalidate, coalescing des cache-miss
concurrents (single-flight), disjoncteur sur la santé de TMDB avec sonde en half-open, snapshot du
cache au `SIGTERM` et réhydratation au boot, arrêt gracieux avec timeout dur. Métriques et état
exposés sur `/api/health`.

**Perf.** Cache HTTP (`Cache-Control` + ETags forts, `no-store` sur les routes privées), cache
client SWR avec dédup des requêtes en vol, SEO dynamique (`title`, `description`, Open Graph,
Twitter Card, canonique) avec `robots.txt` et `sitemap.xml` réécrits au build depuis
`VITE_SITE_URL`.

**Packaging.** Image frontend multi-stage (`vite build` puis nginx), API proxyfiée en même-origine
sous `/api`, conteneurs non-root avec `HEALTHCHECK`, `JWT_SECRET` obligatoire en production,
licence MIT, 142 tests et CI GitHub Actions sur chaque PR.

## Reste

### Avant de rendre le repo public

- [x] **Historique purgé.** Le `.env` commité avant le pivot a été retiré de l'intégralité de
      l'historique (`git filter-repo`), avec les 12 fichiers `.idea/` de config JetBrains. Les 78
      commits et leurs dates d'auteur sont conservés à l'identique. La clé qui y vivait est à
      considérer comme compromise et doit être révoquée côté fournisseur, indépendamment de cette
      purge.
- [x] **Captures d'écran déposées.** Les 5 vues spécifiées dans `docs/screenshots/README.md`, en
      1440 × 900, thème sombre, PNG sous 400 Ko chacune. Galerie active dans le README.
- [ ] **Déployer et renseigner l'URL de démo** dans le README, où le lien est un `#` en attendant.

### Nécessite une infra externe, volontairement non codé en dur

- [ ] **Notifications « ça arrive sur ta plateforme ».** Demande SMTP ou push, un scheduler, et la
      détection d'un changement de disponibilité. À brancher quand l'infra mail est choisie.
- [ ] **Cache partagé (Redis)** pour le scaling multi-instances. Le cache actuel est borné en
      mémoire, par instance.
- [ ] **SEO complet des fiches.** Le `<head>` est déjà piloté par route et par fiche, mais le rendu
      reste client-side : il manque du SSR ou du prerender pour les crawlers qui n'exécutent pas JS.
