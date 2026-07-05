# 🧾 NEOX — Backlog d'audit & sprint

> État initial constaté : le repo **build, lint, typecheck et passe ses 103 tests**
> (backend 41 · frontend 62). C'est une base déjà très aboutie (8 phases livrées).
> Les défauts ci-dessous sont donc surtout des **bugs d'intégration**, des **fuites
> d'i18n** et des **incohérences de feedback** accumulés au fil des itérations — pas
> un chantier structurel.
>
> Méthode : lecture manuelle de tout le code + 3 audits parallèles (backend, couche
> état/i18n, composants), chaque trouvaille revérifiée dans le code avant d'être listée.
> Les faux positifs écartés sont notés en bas.

Légende priorité : **P0** bloquant · **P1** essentiel · **P2** confort — Effort : **S/M/L**

---

## 🔴 À réparer (cassé / incohérent / mort)

- [x] **R1 — Fuite de bibliothèque entre comptes au logout** · P1 · S
  `context/AuthContext.tsx:52` + `context/LibraryContext.tsx:86`. `logout()` efface le token
  et `user` mais **ni `entries` ni `localStorage['neox.library.v1']`**. Sur un appareil partagé :
  A se déconnecte → B se connecte → l'effet de merge envoie **la watchlist de A dans le compte
  de B**. Et hors multi-compte, la liste de A reste visible après déconnexion.
  *Fix : réinitialiser la bibliothèque (state + localStorage) sur la transition user→null.*

- [x] **R2 — `useQuery` : le flag de revalidation forcée ne se réarme jamais** · P2 · S
  `hooks/useQuery.ts:52`. `force = nonce > 0` et `nonce` ne fait qu'incrémenter. Après un seul
  `refetch()` (bouton « Réessayer »), **tous** les fetch suivants du même hook contournent le
  cache frais → la SWR (Home/Discover/Search) refait un appel réseau à chaque frappe/filtre.
  *Fix : rendre le forçage one-shot (comparer à un nonce déjà consommé).*

- [x] **R3 — Messages d'erreur backend codés en dur en français** · P2 · M
  `backend/auth.js` + `backend/server.js` renvoient « E-mail ou mot de passe incorrect. »,
  « Adresse e-mail invalide. », etc. `AuthModal` affiche `err.message` tel quel → un utilisateur
  EN/ES/DE/IT voit des erreurs **en français** sur le flow login/register.
  *Fix : le backend renvoie un `code` d'erreur ; le client mappe code→clé i18n (message backend en fallback).*

- [x] **R4 — Limites contradictoires : body 256 KB vs cap 2000 entrées** · P2 · S
  `backend/server.js:29` (`express.json({ limit: '256kb' })`) vs `backend/library.js:41`
  (`slice(0, 2000)`). Une biblio ≳1300 titres sérialise à >256 KB → `PUT/POST /api/library`
  renvoie **413** avant même `sanitizeLibrary`, échec silencieux de la sync.
  *Fix : aligner la limite du body sur le cap (ex. `1mb`).*

- [x] **R5 — `/api/home` expose un champ `title` mort** · P2 · S
  `backend/tmdb.js:398` calcule des titres de rails en français ; le front les ignore
  (`HomeView.tsx:59` traduit via `t('home.row.${row.id}')`). Champ mort + trompeur.
  *Fix : retirer `title` du payload backend et de `HomeRow` (`types.ts`).*

- [x] **R6 — Message d'erreur TMDB « … : undefined »** · P2 · S
  `backend/tmdb.js:124`. Si les 4 tentatives renvoient 429, `lastError` n'est jamais affecté →
  `TMDB request failed after 4 attempts: undefined`. Cosmétique (statut/breaker corrects).
  *Fix : renseigner `lastError` sur la branche 429.*

---

## 🟡 Essentiel manquant

- [x] **E1 — Aucune navigation mobile vers Films / Séries** · P1 · M
  `components/layout/Navbar.tsx:75`. La nav (`Accueil/Films/Séries`) est `hidden md:flex`, le
  bouton ⌘K est `hidden sm:inline-flex`, **aucun menu hamburger**. Sur téléphone (<768 px), il
  n'existe **aucun moyen tactile d'atteindre `/movies` ou `/tv`** — les deux pages de découverte
  principales d'une app pourtant « mobile-first ». *Fix : menu mobile (dropdown hamburger réutilisant
  le pattern du menu compte, `md:hidden`).*

---

## 🟢 Contenu à compléter (feedback, i18n, empty states)

- [x] **C1 — Toasts d'ajout/retrait absents depuis Hero et la fiche** · P2 · S
  `components/home/Hero.tsx:82` et `components/media/DetailModal.tsx:218,229,241` : `toggle`/
  `setStatus`/`remove` **sans toast**, alors que `MediaCard` en émet. Le README promet un retour
  sur « chaque ajout/retrait ». *Fix : émettre un toast cohérent depuis ces deux surfaces.*

- [x] **C2 — Chaînes UI codées en dur hors i18n** · P2 · S
  `components/layout/Logo.tsx:8` (`aria-label="NEOX — accueil"`, FR pour tous),
  `components/auth/AuthModal.tsx:87` (placeholder e-mail),
  guillemets `« »` figés autour du terme recherché pour toutes les langues
  (`views/SearchView.tsx:20,68` + `components/command/CommandPalette.tsx:253`, faux en EN/DE).
  *Fix : passer par `t()` / des guillemets dépendants de la langue.*

- [x] **C3 — Titre/description SEO par défaut figés en français** · P2 · S
  `lib/seo.ts:24-26`. Sur la page d'accueil (sans `title`), l'onglet du navigateur affiche
  toujours « NEOX — Ton radar cinéma & séries » quelle que soit la langue. *Fix : localiser les défauts.*

- [x] **C4 — Reco « Similaires » sans affiche = case grise vide** · P2 · S
  `components/media/DetailModal.tsx:320`. Si `rec.poster` est null, rien n'est rendu (vs icône
  de repli dans `MediaCard`/casting). *Fix : icône de repli Film/Tv.*

- [x] **C5 — « Tout effacer » sans confirmation** · P2 · S
  `views/LibraryView.tsx:80`. Un clic vide toute la bibliothèque (juste un toast). Action
  destructive irréversible. *Fix : confirmation avant `clear()`.*

---

## ✅ Écarté (vérifié, pas un défaut / hors scope)

- `/api/trending/:mediaType` sans consommateur front → **gardé** : endpoint public documenté
  dans le tableau API du README.
- `api.getLibrary` non appelé → **gardé** : méthode de client complète pour une route réelle.
- Props optionnelles inertes (`StarRating.size`, `RatingBadge.className`) et champs TMDB
  non affichés (`originalTitle`, `status`, `numberOfEpisodes`) → inoffensifs, non touchés
  (risque > bénéfice, types partagés).
- JWT sans `algorithms` explicite, 409 register révélant l'existence d'e-mail, half-open du
  circuit breaker → compromis acceptables, pas des défauts.
