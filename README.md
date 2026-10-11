# Emplois du temps & salles — Département de français (S1 2026-2027)

Plateforme web pour gérer les emplois du temps du département et **résoudre les conflits de salles**.

- `plateforme/` — le site (HTML/CSS/JS, sans dépendance, fonctionne hors-ligne). Ouvrir `plateforme/index.html`.
- `time tables/` — les documents Word d'origine (L1, L2, L3, M1/M2 Ling & Did).
- `nouveaux emplois du temps/` — les emplois du temps corrigés (Word + Excel).

## Déploiement sur Vercel
Importer le dépôt dans Vercel : aucune configuration nécessaire, `vercel.json` publie le dossier `plateforme/`.

## Fonctionnalités
- Détection des conflits : salle occupée deux fois, salle indisponible, enseignant à deux endroits, même groupe dans deux séances.
- Résolution automatique : ne change **que les salles** (jours, horaires, enseignants et groupes inchangés), avec aperçu avant application.
- Modification, ajout, suppression, glisser-déposer, annuler/rétablir.
- Vues par niveau, par salle, salles libres, par enseignant ; liste des modifications.
- Exports : Word (.docx), Excel (.xlsx), impression/PDF, sauvegarde JSON.

Les modifications sont enregistrées dans le navigateur de chaque utilisateur (pensez à la sauvegarde JSON).
