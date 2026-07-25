# Captures d'écran

Ces fichiers alimentent la galerie du README. Ils ne sont **pas** générés
automatiquement : les vues ont besoin d'une vraie clé TMDB pour afficher du
contenu, et une capture d'un état vide dessert le projet plus qu'elle ne le sert.

## À capturer

Lance l'app avec une clé TMDB valide, puis prends ces cinq vues :

| Fichier | Vue | Ce qu'on doit y voir |
|---|---|---|
| `home.png` | Accueil `/` | Le hero avec un backdrop chargé + au moins deux rails sous la ligne de flottaison |
| `detail.png` | Fiche d'un film | Bande-annonce visible, casting, et surtout la section « Où regarder (légalement) » avec des plateformes |
| `discover.png` | Explorer `/movies` | Filtres genre/année/note ouverts, grille remplie |
| `library.png` | Ma liste `/library` | Quelques titres notés + le panneau « Statistiques » déplié (histogramme visible) |
| `command.png` | N'importe quelle vue, ⌘K ouvert | Palette avec des résultats de recherche et des recherches récentes |

## Conseils

- **Fenêtre en 1440 × 900**, thème sombre (le seul thème de l'app).
- Format **PNG**, redimensionné à **1440 px de large max** et compressé
  (`pngquant`, `oxipng` ou <https://squoosh.app>) : vise < 400 Ko par fichier,
  sinon le README devient lourd à charger sur mobile.
- Une **capture animée** (GIF ou MP4) de la palette ⌘K vaut plus que les cinq
  images réunies : c'est la fonctionnalité qui se démontre le mieux en mouvement.
  Si tu en fais une, nomme-la `command.gif` et mets-la en tête de galerie.
- Évite d'y faire figurer une adresse e-mail réelle sur la vue connectée.

Une fois les fichiers déposés ici, décommente le bloc `<!-- GALERIE -->` dans le
README à la racine.
