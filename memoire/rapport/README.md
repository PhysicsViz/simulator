# Mémoire — sources LaTeX

Squelette complet du mémoire (≈ 75 pages hors annexes) : introduction, trois
parties de taille égale (état de l'art, réalisation, résultats) et conclusion.
Les encadrés jaunes **« À rédiger »** indiquent pour chaque section le contenu
attendu, les sources à citer et le nombre de pages visé ; supprimez l'encadré
quand la section est écrite.

Déjà rédigé :

- `chapitres/09-jeu-seau.tex` : le jeu du seau d'eau (corde pliable, eau en
  particules, résolution directe, validation), environ 5 à 6 pages avec ses
  figures ;
- `sections/methodologie.tex` : la méthodologie de développement assistée par
  IA, reprise de `../methodologie.tex` (titres abaissés d'un niveau) ;
- la section du looping avec wagon (`chapitres/08-...`), en partie.

## Compiler

- **Overleaf** : téléversez le dossier `rapport/` (zip), compilateur
  *pdfLaTeX*, document principal `memoire.tex`. Biber est lancé
  automatiquement.
- **Sur votre PC (Windows)** :
  1. installer MiKTeX : `winget install MiKTeX.MiKTeX` (ou l'installeur de
     miktex.org), puis ouvrir *MiKTeX Console* → *Settings* → « Always install
     missing packages on-the-fly » et faire *Check for updates* ;
  2. rouvrir le terminal, puis depuis la racine du dépôt :
     `powershell -ExecutionPolicy Bypass -File memoire\rapport\compiler.ps1`
     (pdflatex, biber, pdflatex ×2 ; le premier passage télécharge les paquets,
     quelques minutes) → `memoire\rapport\memoire.pdf` ;
  3. dans VS Code, l'extension *LaTeX Workshop* compile à chaque sauvegarde ;
     sa recette par défaut utilise latexmk, qui demande Perl sous MiKTeX
     (`winget install StrawberryPerl.StrawberryPerl`), sinon choisir la recette
     « pdflatex ➞ bibtex ➞ pdflatex × 2 » en remplaçant bibtex par biber.

Paquets utilisés : babel (french), siunitx, pgfplots, tikz, tcolorbox,
algorithm / algpseudocode, biblatex (biber), cleveref, titlesec, fancyhdr.

## Organisation

| Fichier | Contenu | Pages visées |
|---|---|---|
| `chapitres/01-introduction.tex` | contexte, questions de recherche, plan | 4 |
| `chapitres/02` à `06` | **Partie I — état de l'art** : difficultés en mécanique, simulations, ludification, méthodes numériques, IA | 24 |
| `chapitres/07` à `10` | **Partie II — réalisation** : cahier des charges + méthodologie, architecture et exercices, jeu du seau, validation | 24 |
| `chapitres/11` à `14` | **Partie III — résultats** : protocole, résultats quantitatifs et qualitatifs, discussion | 23 |
| `chapitres/15-conclusion.tex` | synthèse et perspectives | 3 |
| `chapitres/16-annexes.tex` | instruments, `CLAUDE.md`, galerie | hors compte |
| `bibliographie.bib` | 28 références (à vérifier avant dépôt) | |

## Figures (régénérables depuis le code du site)

Les figures sont produites à partir du code réel du dépôt, pour que le texte et
l'application ne divergent jamais. Depuis la racine du dépôt :

```bash
node memoire/rapport/outils/donnees.mjs    # CSV des graphiques (pgfplots)
node memoire/rapport/outils/captures.cjs   # captures d'écran (Playwright)
```

- `figures/donnees/` : réaction normale le long du looping, tension du seau
  simulée et théorique, allongement de la corde (Gauss–Seidel ou résolution
  directe), seuil de réussite simulé du jeu sur 24 configurations ;
- `figures/captures/` : accueil, looping sur un écran, décollage, version
  téléphone, jeu réussi, séquence d'un essai raté (défi tiré avec une graine
  fixe, donc reproductible).

Si vous modifiez la physique du jeu, relancez les deux scripts puis mettez à
jour les chiffres cités dans `chapitres/09-jeu-seau.tex` (seuil k, écart de
tension, temps de calcul, instants de la séquence ratée).
