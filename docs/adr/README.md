# Architecture Decision Records (ADR)

Décisions d'architecture **non-évidentes** du projet, au format [MADR](https://adr.github.io/madr/) minimal.

## Règles
- 1 décision par fichier, nommé `NNNN-titre-kebab.md`.
- **Append-only** : on n'édite pas un ADR accepté. Si une décision change, créer un nouvel ADR
  qui « supersede » l'ancien et les lier.
- Critère d'admission : *un nouveau dev, sans cette note, tenterait-il de « corriger » ça et
  casserait-il quelque chose ?* Si non → c'est une section de `docs/ARCHITECTURE.md`, pas un ADR.

## Index
- [0001](0001-persistance-dual-mode.md) — Persistance dual-mode (localStorage ↔ Supabase) — *les 2 drapeaux de migration
  qu'il décrit ont été retirés : voir 0005*
- [0002](0002-i18n-inline-par-composant.md) — i18n inline par composant (pas de lib globale) — *périmètre linguistique
  remplacé par 0005 : 2 langues, pas 5*
- [0003](0003-custom-recipes-vue.md) — `custom_recipes` est une VUE, pas une table
- [0004](0004-donnees-static-vs-supabase.md) — Données : fichiers statiques ↔ Supabase — *remplacé en partie par 0005*
- [0005](0005-corrections-audit-2026-08-28.md) — Corrections apportées par l'audit du 2026-08-28
- [0006](0006-paliers-d-acces-premium.md) — Trois paliers d'accès : un visiteur ne voit aucun point d'entrée Premium,
  un compte gratuit les voit verrouillés

## Template
```md
# NNNN — <titre>

- Statut : accepté
- Date : AAAA-MM-JJ

## Contexte et problème
## Décision
## Conséquences
```
