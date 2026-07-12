# 🧾 NEOX — Backlog d'audit & sprint (cycle 4)

> État constaté (2026-07-12) : le repo **build, lint, typecheck et passe ses 106 tests**
> (backend 44 · frontend 62). Base **très aboutie** (8 phases + 3 cycles d'audit livrés,
> backlogs cycles 1–3 entièrement cochés).
>
> Ce quatrième passage est un audit **frais et sceptique**, avec cette fois une
> **vérification au runtime** (app lancée + instrumentation réseau via navigateur headless),
> ce que les cycles précédents n'avaient pas fait sur le parcours « fiche ». Résultat : une
> **régression bloquante (P0)** est démasquée — le modal de fiche part en **boucle de rendu /
> fetch infinie** (≈ 1 250 requêtes en 4 s sur le chemin nominal). C'est le seul défaut réel
> trouvé ; le reste du code (backend + frontend) est propre et cohérent.

Légende priorité : **P0** bloquant · **P1** essentiel · **P2** confort — Effort : **S/M/L**

---

## 🔴 À réparer (cassé / incohérent / mort)

- [ ] **R1 — `DetailModal` : boucle de rendu/fetch infinie sur l'ouverture d'une fiche** · P0 · S
  `hooks/useDetailRoute.ts:44-51` + `components/media/DetailModal.tsx:48-53`.
  `useDetailTarget()` reconstruit `target = { id, mediaType }` **en littéral d'objet à chaque
  render**. L'effet `useEffect(() => { …; load(target.mediaType, target.id); }, [target, load])`
  du modal dépend donc d'une **référence qui change à chaque commit** → l'effet se relance à
  chaque render, rappelle `load()` (qui fait `setLoading` / `setDetails`) → nouveau render →
  nouveau `target` → **boucle**. Vérifié au runtime : **1 249 requêtes `/api/movie/550` en 4 s**
  sur une réponse 200 mockée (et un flot identique sur le chemin d'erreur). Impact : parcours
  cœur « ouvrir un titre » inutilisable (spinner qui clignote), martèlement de l'API et du quota
  TMDB, risque d'auto-rate-limit du backend. Les 3 cycles précédents ne l'ont pas vu : l'env
  d'audit n'a pas de clé TMDB, la fiche restait bloquée sur l'état d'erreur et personne n'a
  regardé l'onglet réseau. `PersonModal` n'est **pas** touché (il dépend d'un `personId`
  numérique, référence stable).
  *Fix : mémoïser `target` dans `useDetailTarget` (`useMemo` clavé sur la chaîne brute
  `?watch=`), pour qu'il garde une référence stable tant que le deep-link ne change pas —
  exactement le motif « clé stable » déjà employé par `useDocumentMeta`.*

---

## 🟡 Essentiel manquant

- _(Rien.)_ Tous les parcours cœur sont présents et câblés de bout en bout : accueil,
  recherche, explorer (filtres + scroll infini), fiche (BA/providers/casting/reco), notation,
  biblio (import/export/stats/tri/filtre), comptes + sync, « vu récemment », « pour toi »,
  ⌘K, i18n 5 langues. Aucune absence ne bloque un usage évident — pas de scope inventé.

---

## 🟢 Contenu à compléter (SEO / a11y / feedback)

- _(Rien.)_ Aucun placeholder ni stub sur les parcours critiques : les seuls `placeholder=`
  restants sont des attributs de champs de saisie légitimes ; aucun `TODO`/`FIXME`/`lorem`
  dans le code ; balayage i18n = **0 chaîne utilisateur en dur** (seul `Esc`, libellé de touche
  universel, n'est pas traduit — volontaire). Les fuites SEO/a11y (langue du document,
  double-message « 0 résultat », erreurs cachables) ont été corrigées au cycle 3.

---

## ✅ Écarté (vérifié, pas un défaut / hors scope / décision antérieure maintenue)

- **Écritures `localStorage` sans garde de quota** (`LibraryContext`, `useMyPlatforms`,
  `recent-searches`, `api.setLocale`…) → les helpers de lecture sont déjà tolérants aux pannes,
  et `rememberViewed`/`recently-viewed` entourent l'écriture d'un `try/catch`. Un `QuotaExceeded`
  sur la biblio est un cas extrême (2000 entrées cap serveur) ; le durcir imposerait une UX
  d'erreur non demandée. Pas un défaut bloquant.
- Tous les points déjà **écartés aux cycles 1–3** restent valides et ne sont pas ré-instruits :
  recherche = page 1 + comptage `totalResults`, exports « morts » `api.getLibrary` /
  `clearRecent`, sémantique `cache.get()` (stale = miss), `manifest.lang` build-time,
  Dockerfile frontend `vite dev`, side-channel de timing au login.
</content>
