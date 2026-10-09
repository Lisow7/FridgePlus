# scripts/legacy

Scripts qui ont servi à des tâches ponctuelles de migration ou d'audit, archivés ici plutôt que supprimés pour faciliter d'éventuels retours debug. Git garde déjà l'historique mais l'archive locale rend la consultation plus directe.

## Contenu

### `extract-nutrition.mjs`
A servi à extraire les valeurs nutritionnelles des recettes vers la table `ingredients` (colonne `nutrition`) lors de la migration data → BDD (Phase 1, v3.3.13).
Plus utilisé : la nutrition est maintenant lue directement depuis Supabase.

### `verify-allergens.mjs`
Vérification one-shot que les 14 allergènes UE étaient bien rattachés à chaque ingrédient avant la livraison de la V5 nutrition+allergènes (v2.4.0).
Plus utilisé : les allergènes sont validés à la création/édition d'ingrédient via le panel admin.

### `verify-diet-breakers.mjs`
Vérification one-shot que la liste `dietBreakingIds` couvrait toutes les recettes existantes lors de la mise en place du filtrage par régime alimentaire.
Plus utilisé : la donnée vit dans `breaks_diets[]` côté BDD.

## Pourquoi archiver plutôt que supprimer

- Servent de référence si on doit ré-auditer la nutrition / les allergènes / les régimes plus tard
- Décrivent implicitement la « shape » des données attendues (utile pour reprise post-launch)
- Coût de garde quasi nul (3 fichiers, pas dans le bundle, ignorés par tests/lint/build)

## Quand supprimer

Après le launch public + 6 mois sans retour utilisateur sur ces domaines, on peut purger sans regret. Le `git log` reste le filet ultime.
