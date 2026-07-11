# 🧾 NEOX — Backlog d'audit & sprint (cycle 3)

> État constaté (2026-07-11) : le repo **build, lint, typecheck et passe ses 103 tests**
> (backend 41 · frontend 62). Base **très aboutie** (8 phases + 2 cycles d'audit livrés,
> backlogs cycles 1 & 2 entièrement cochés).
>
> Ce troisième passage est un audit **frais et sceptique** : relecture manuelle de
> l'intégralité du code + 2 audits parallèles (backend / frontend), chaque trouvaille
> revérifiée dans le code avant d'être listée. **Aucun bug bloquant (P0)** ; aucune
> feature essentielle manquante. Ce qui reste : une **incohérence de comportement du
> disjoncteur** (le code contredit ses propres commentaires), quelques **incohérences
> d'état UI** et des **fuites SEO/a11y** résiduelles sur la langue du document.

Légende priorité : **P0** bloquant · **P1** essentiel · **P2** confort — Effort : **S/M/L**

---

## 🔴 À réparer (cassé / incohérent / mort)

- [x] **R1 — Le disjoncteur TMDB ne respecte pas sa « sonde unique » en half-open** · P1 · M
  `backend/circuit-breaker.js` + `backend/tmdb.js`. En `half-open`, `allow()` renvoie `true`
  pour **tous** les appelants concurrents (rien ne marque une sonde « en vol ») — alors que
  les commentaires (`circuit-breaker.js:18-19,62`) affirment « lets a single probe through ».
  Sous panne TMDB durable, après le cooldown une rafale de requêtes **d'URLs distinctes**
  (le single-flight ne coalesce que les URLs identiques) stampede l'amont mort, chacune
  vidant son budget de retry — exactement ce que le breaker doit empêcher. Amplification :
  `_trip()` réécrit `openedAt` même déjà ouvert → les traînards **rallongent la fenêtre
  open** au-delà du cooldown. Corollaires : (a) une sonde qui reçoit un **4xx** ne déclenche
  ni `recordSuccess` ni `recordFailure` → breaker figé en half-open ; (b) `flights`
  (`single-flight`) est **incrémenté même quand le breaker court-circuite** sans fetch →
  `/api/health` rapporte des « appels amont » fictifs pendant une panne.
  *Fix : garde `halfOpenProbing` (une seule sonde), `openedAt` non réécrit si déjà open,
  un 4xx amont compte comme succès breaker (amont vivant), et check `breaker.allow()`
  **avant** le single-flight (plus de flight fantôme).*

- [x] **R2 — `AuthContext.ready` est calculé/exposé mais jamais consommé → flash « déconnecté » au boot** · P2 · S
  `context/AuthContext.tsx:15,25,67`. Le flag `ready` (censé masquer l'état transitoire
  pendant la validation du token au boot) n'est lu **nulle part**. Un utilisateur avec token
  valide qui recharge voit `user === null` tant que `me()` est en vol → la navbar affiche
  « Connexion » puis bascule sur l'avatar (flash logged-out → logged-in à chaque chargement).
  *Fix : consommer `ready` dans la navbar (placeholder neutre du slot compte tant que
  `!ready`) pour supprimer le flash — c'est l'intention d'origine, à moitié câblée.*

- [x] **R3 — `DiscoverView` : effet de reset mort/redondant (et incomplet)** · P2 · S
  `views/DiscoverView.tsx:61-66`. Depuis le fix cycle 2, `App.tsx:48-49` remonte la vue via
  `key="movie"`/`key="tv"` : `mediaType` est donc **constant** dans une instance, et cet
  `useEffect([mediaType])` ne tourne qu'une fois au montage en réassignant des valeurs déjà
  par défaut. Deux mécanismes font le même travail ; pire, l'effet est trompeur (il ne reset
  ni `items`/`page`/`showPlatforms`, contrairement au remount).
  *Fix : supprimer l'effet redondant (le remount clavé couvre déjà tout le reset).*

---

## 🟡 Essentiel manquant

- _(Rien.)_ Tous les parcours cœur sont présents et câblés de bout en bout : recherche,
  explorer (filtres + scroll infini), fiche (BA/providers/casting/reco), notation, biblio
  (import/export/stats/tri/filtre), comptes + sync, « vu récemment », « pour toi », ⌘K,
  i18n 5 langues. Aucune absence ne bloque un usage évident — pas de scope inventé.

---

## 🟢 Contenu à compléter (SEO / a11y / feedback)

- [ ] **C1 — `<html lang>` et `og:locale` figés « fr » quelle que soit la langue active** · P2 · S
  `project/index.html:2` déclare `lang="fr"` en dur ; `lib/seo.ts` pilote titre/description/OG
  mais ne touche jamais `document.documentElement.lang` (aucune écriture dans tout le repo).
  Sur une locale US/GB/ES/DE/IT le chrome est traduit mais le document annonce `lang="fr"` →
  prononciation lecteur d'écran erronée + mauvaise détection de langue par les crawlers.
  *Fix : aligner `document.documentElement.lang` sur la langue UI active au boot (+ balise
  `og:locale`). Un switch de langue hard-reload, donc la valeur est stable par session.*

- [ ] **C2 — Recherche sans résultat : double message « 0 résultats » + empty state** · P2 · S
  `views/SearchView.tsx:76-80` affiche la ligne de comptage dès que `debounced && !loading
  && !error` (vrai pour une recherche finie à 0 résultat), tandis que le ternaire principal
  (`:92-97`) affiche déjà l'empty state « Aucun résultat ». Sur une requête vide de résultats,
  l'UI montre **« 0 résultats »** ET **« Rien trouvé pour … »** — messages redondants/contradictoires.
  *Fix : n'afficher le comptage que lorsqu'il y a des résultats.*

- [ ] **C3 — `cacheControl` : la garantie « errors never cached » n'est pas appliquée** · P2 · S
  `backend/http-cache.js:36-40`. Le commentaire promet « never cache 4xx/5xx », mais le
  middleware ne **pose aucun** en-tête sur les réponses non-2xx et s'appuie sur l'absence
  d'en-tête. Or un cache partagé (CDN — on annonce `s-maxage`) peut mettre en cache
  **heuristiquement** certains statuts (404/410, RFC 7234 §4.2.2). Un `GET /api/:type/:id`
  d'un titre inexistant renvoie un vrai 404 qu'un CDN pourrait figer.
  *Fix : poser explicitement `Cache-Control: no-store` sur les réponses non-2xx.*

---

## ✅ Écarté (vérifié, pas un défaut / hors scope / décision antérieure maintenue)

- **Recherche = page 1 uniquement, comptage = `totalResults`** → décision cycle 2 maintenue
  (la pertinence TMDB place la cible dans le top 20 ; la pagination serait une *feature*, pas
  un manque bloquant). Seul le double-message à 0 résultat est corrigé (C2).
- **Exports morts `api.getLibrary` / `recently-viewed.clearRecent`** → conservés (statué
  cycle 1 : API cliente complète pour une route réelle, inoffensif ; risque > bénéfice).
- **`cache.get()` compte un stale-serve comme `miss`** → définition « fresh-hit-rate »
  défendable ; `staleServed` est tracké séparément. Pas de changement de sémantique métrique.
- **PWA manifest `lang: 'fr'`** → valeur build-time d'un fichier unique ; la rendre par-user
  imposerait une génération runtime du manifest (infra), hors scope de cet audit.
- **Dockerfile frontend `vite dev` en prod** → limitation de déploiement documentée (ROADMAP),
  choix d'infra assumé, pas un bug de code.
- **Timing side-channel au login** (bcrypt sauté si e-mail inconnu) → durcissement marginal ;
  l'inscription révèle déjà l'existence d'un e-mail (409). Compromis accepté cycles 1-2.
