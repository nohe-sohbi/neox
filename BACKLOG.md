# 🧾 NEOX — Backlog d'audit & sprint (cycle 2)

> État constaté (2026-07-10) : le repo **build, lint, typecheck et passe ses 103 tests**
> (backend 41 · frontend 62). C'est une base **très aboutie** (8 phases + un premier
> cycle d'audit déjà livrés) — le backlog du cycle 1 est entièrement coché.
>
> Ce second passage est donc un audit **frais et sceptique** : relecture manuelle de
> l'intégralité du code + 2 audits parallèles (backend / frontend), chaque trouvaille
> revérifiée dans le code avant d'être listée. Il n'y a **aucun bug bloquant (P0)** ;
> ce qui reste est de la **robustesse d'intégrité de données**, quelques **incohérences
> d'état** et des **fuites d'i18n / SEO** résiduelles.

Légende priorité : **P0** bloquant · **P1** essentiel · **P2** confort — Effort : **S/M/L**

---

## 🔴 À réparer (cassé / incohérent / mort)

- [x] **R1 — `store.js` avale les erreurs d'écriture → 200 sur une sauvegarde ratée** · P1 · M
  `backend/store.js:31-55`. `persist()` appelle `resolve()` (jamais `reject`) dans **toutes**
  les branches d'erreur (mkdir/write/rename). Donc `await store.setLibrary(...)` et
  `await store.createUser(...)` réussissent même quand rien n'a été écrit sur disque.
  *Scénario : disque plein ou `DATA_DIR` non inscriptible → `PUT /api/library` renvoie **200**
  avec les entrées, mais la sync n'a rien persisté ; au redémarrage la biblio est perdue.*
  *Fix : découpler la chaîne de sérialisation (qui doit rester vivante) du résultat par appel
  (qui doit rejeter en cas d'échec) → la route renvoie 500 au lieu d'un faux succès.*

- [x] **R2 — `PUT /api/library` efface la biblio cloud sur un body malformé** · P2 · S
  `backend/server.js:229-237`. `sanitizeLibrary(req.body?.entries)` renvoie `[]` pour un
  `entries` absent/non-tableau, puis `setLibrary(userId, [])` **remplace toute la biblio** et
  renvoie 200. Un bug client ou un champ manquant détruit silencieusement les données synchronisées.
  *Fix : rejeter en 400 quand `entries` n'est pas un tableau (un `[]` explicite = vidage
  légitime reste autorisé).*

- [x] **R3 — `recommend()` crashe (500) sur des seeds malformés** · P2 · S
  `backend/tmdb.js:454-456`. Le filtre déréférence `s.mediaType` avant de valider que `s` est
  un objet, **avant** le garde `valid.length === 0`. `POST /api/recommendations` avec
  `{"seeds":[null]}` → `TypeError` → 500 au lieu d'ignorer l'élément.
  *Fix : `s && typeof s === 'object' && ...` dans le filtre.*

- [x] **R4 — `DiscoverView` double-fetch (et mauvais genre) au changement d'onglet Films↔Séries** · P2 · S
  `views/DiscoverView.tsx:61-66` (reset) et `:133-136` (fetch) réagissent tous deux au même
  changement de `mediaType`. Au render où `mediaType` bascule, l'état de filtre porte encore
  les valeurs de l'onglet précédent → un `api.discover('tv', { genre: <id film> })` part
  d'abord (résultats faux/vides), aussitôt remplacé par la requête correcte.
  *Fix : remonter la vue par `key={mediaType}` (état de filtre réinitialisé, une seule requête).*

- [x] **R5 — Un 401 laisse l'UI en état « connecté » périmé** · P2 · S
  `lib/api.ts:106` efface le token sur tout 401, mais rien ne réinitialise `user` dans
  `context/AuthContext.tsx` (seul le `me()` du boot le fait). Après expiration du token en
  cours de session : la navbar garde l'avatar + « Connecté en tant que », et
  `LibraryContext.schedulePush` continue des `putLibrary` qui 401 en silence. Ne se corrige
  qu'au reload.
  *Fix : sur un 401 « authentifié », émettre un event que `AuthProvider` écoute pour vider `user`.*

- [x] **R6 — Les métriques de cache double-comptent les miss** · P2 · S
  `backend/tmdb.js:88 & 97`. Sur chaque miss/stale, `cache.get(cacheKey)` tourne ligne 88 (hors
  flight) **puis** ligne 97 (dans le flight), incrémentant `misses` deux fois → `hitRate` sous-
  estimé dans `/api/health`. Aucun impact fonctionnel, diagnostics faussés seulement.
  *Fix : réutiliser le résultat de la ligne 88 dans le flight au lieu de re-appeler `get`.*

- [x] **R7 — Race check-then-act à l'inscription → doublons d'e-mail** · P2 · S
  `backend/server.js:191-197`. `findUserByEmail` (sync) puis `await hashPassword(...)` rend la
  main avant `createUser`. Deux `register` concurrents pour le même e-mail passent tous deux le
  contrôle → deux comptes, même e-mail, UUID différents ; le second est orphelin.
  *Fix : re-contrôler l'unicité **dans** `createUser` (chemin d'écriture) et rejeter atomiquement.*

---

## 🟡 Essentiel manquant

- _(Rien.)_ Les parcours principaux sont complets : nav mobile, recherche, explorer (filtres +
  scroll infini), fiche, biblio, comptes/sync, i18n, PWA, ⌘K. Aucune absence ne bloque un usage
  évident du produit — pas de scope inventé ici.

---

## 🟢 Contenu à compléter (feedback, i18n, SEO)

- [x] **C1 — `person.knownFor` (métier) toujours en anglais** · P2 · S
  `backend/tmdb.js:441` renvoie `known_for_department` tel quel (« Acting », « Directing »…),
  affiché en évidence sous le nom dans `PersonModal.tsx:103` + la meta description, quelle que
  soit la langue UI. Fuite i18n sur un ensemble fini et mappable de départements.
  *Fix : mapper le département vers une clé i18n (fallback = valeur brute).*

- [x] **C2 — `sitemap.xml` a un namespace invalide + `robots.txt` pointe un sitemap relatif** · P2 · S
  `project/public/sitemap.xml:7` déclare `xmlns="http://www.sitemap.org/..."` (au lieu de
  **`sitemaps.org`**, pluriel) → namespace du protocole invalide, sitemap rejeté par les
  validateurs. `project/public/robots.txt` déclare `Sitemap: /sitemap.xml` (relatif) alors que
  le protocole exige une **URL absolue**.
  *Fix : corriger le namespace + rendre l'URL du sitemap absolue.*

- [x] **C3 — Noter un titre bascule À voir→Vu en silence, sans toast** · P2 · S
  `components/media/DetailModal.tsx:266` → `StarRating.onChange` → `setRating`, qui force
  `status: 'watched'` (`LibraryContext.tsx:144-149`) **sans toast**, alors que le bouton
  « Marquer comme vu » en émet un et que toutes les autres mutations de biblio donnent un retour.
  *Fix : émettre un toast de confirmation à la notation.*

- [ ] **C4 — `AuthModal` ne mappe pas tous les codes d'erreur auth** · P2 · S
  `components/auth/AuthModal.tsx:16-22` couvre 5 codes mais pas `AUTH_ACCOUNT_NOT_FOUND`,
  `AUTH_REQUIRED`, `AUTH_SESSION_INVALID` → sur ces chemins (rares) le message backend en
  **français** est affiché en fallback. Complète l'intention du cycle 1 (R3).
  *Fix : ajouter les 3 clés i18n manquantes au mapping.*

---

## ✅ Écarté (vérifié, pas un défaut / hors scope)

- **Timing side-channel au login** (`server.js:208-211`, bcrypt sauté si e-mail inconnu) → pur
  durcissement ; l'inscription révèle déjà l'existence d'un e-mail via le 409 (compromis accepté
  au cycle 1). Bénéfice marginal, non touché.
- **Code mort `api.getLibrary` / `recently-viewed.clearRecent`** → conservés : le cycle 1 a déjà
  statué « API client complète pour une route réelle, inoffensif » (risque > bénéfice).
- **`MediaCard` : `<button>`/`<h3>` imbriqués dans un `role="button"`** → ARIA discutable mais
  fonctionnel (clic interne `stopPropagation`) ; refactor risqué pour un bénéfice faible.
- **Dockerfile frontend lance `vite dev` en prod** → limitation de déploiement **documentée**
  dans la ROADMAP (multi-stage `build` + nginx à brancher au déploiement), choix d'infra assumé,
  pas un bug de code.
- **Recherche = page 1 seulement (pas de scroll infini)** → la pertinence TMDB place la cible
  dans le top 20 ; ajouter la pagination serait une feature, pas un manque bloquant.
- **Half-open du circuit breaker non verrouillé à une seule sonde** → compromis accepté au cycle 1.
</content>
</invoke>
