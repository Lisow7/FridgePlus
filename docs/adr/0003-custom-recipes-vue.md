# 0003 — `custom_recipes` est une VUE, pas une table

- Statut : accepté
- Date : 2026-06-22

## Contexte et problème
Le code et la BDD exposent `custom_recipes`. Un nouveau dev suppose naturellement que c'est une table.

## Décision
`custom_recipes` est une **VUE** PostgreSQL (définie dans `supabase/migrations/`, ex.
`20260615_fix_recipe_view_consent_aimod.sql` → `CREATE OR REPLACE VIEW public.custom_recipes`),
qui agrège des données d'autres tables — **pas** une table physique.

## Conséquences
- (−) **Piège** : on ne peut pas traiter `custom_recipes` comme une table en écriture ; écrire dans
  les tables sous-jacentes. Un `INSERT INTO custom_recipes` ne fait pas ce qu'on croit.
- ⚠️ La vue utilise `security_invoker` (cf. `20260616_custom_recipes_security_invoker.sql`) :
  **tout futur `CREATE OR REPLACE VIEW custom_recipes` DOIT le réinclure**, sinon la RLS des tables
  sous-jacentes n'est plus appliquée via la vue (faille potentielle).
- (+) Lecture unifiée sans dupliquer la donnée.
- Source de vérité : la définition dans `supabase/migrations/`.
