# Architecture Decision Records (ADR)

Décisions d'architecture **non-évidentes** du projet, au format [MADR](https://adr.github.io/madr/) minimal.

## Règles
- 1 décision par fichier, nommé `NNNN-titre-kebab.md`.
- **Append-only** : on n'édite pas un ADR accepté. Si une décision change, créer un nouvel ADR
  qui « supersede » l'ancien et les lier.
- Critère d'admission : *un nouveau dev, sans cette note, tenterait-il de « corriger » ça et
  casserait-il quelque chose ?* Si non → c'est une section de `docs/ARCHITECTURE.md`, pas un ADR.

## Index
- [0001](0001-persistance-dual-mode.md) — Persistance dual-mode (localStorage ↔ Supabase, 2 flags de migration)
- [0002](0002-i18n-inline-par-composant.md) — i18n inline par composant (pas de lib globale)
- [0003](0003-custom-recipes-vue.md) — `custom_recipes` est une VUE, pas une table
- [0004](0004-donnees-static-vs-supabase.md) — Données : fichiers statiques ↔ Supabase

## Template
```md
# NNNN — <titre>

- Statut : accepté
- Date : AAAA-MM-JJ

## Contexte et problème
## Décision
## Conséquences
```
