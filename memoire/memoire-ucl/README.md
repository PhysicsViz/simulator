# Mémoire — squelette au format EPL

Squelette du mémoire, **titres seulement**, avec la couverture officielle de
l'EPL (classe `EPL-master-thesis-covers-FR.cls` et bandeaux PDF copiés du
paquet « EPL-master-thesis-covers-templates-Word-LaTeX »).

- `couverture/couverture.tex` : couvertures avant et arrière (remplir les
  champs entre crochets). Les instructions de l'EPL demandent de générer ces
  deux pages en PDF et de les joindre au manuscrit : `memoire.tex` les insère
  avec `pdfpages` (page 1 en tête, page 2 en fin).
- `memoire.tex` : corps du mémoire ; un fichier par chapitre dans `chapitres/`.
- `bibliographie.bib` : références (style IEEE, biblatex + biber).

Structure (calquée sur la grille d'évaluation du mémoire de l'EPL : fondements
et état de l'art, méthodologie, résultats et validité, discussion critique,
normes et éthique) : pages liminaires (remerciements, résumé, déclaration
d'utilisation de l'IA), introduction, partie I *État de l'art*, partie II
*Réalisation*, partie III *Résultats*, conclusion, bibliographie, annexes.

## Compiler

`powershell -ExecutionPolicy Bypass -File memoire\memoire-ucl\compiler.ps1`
→ `memoire\memoire-ucl\memoire.pdf` (compile d'abord la couverture, puis le
corps : pdflatex, biber, pdflatex × 2). Sur Overleaf : compiler d'abord
`couverture/couverture.tex`, télécharger `couverture.pdf` dans `couverture/`,
puis compiler `memoire.tex`.
