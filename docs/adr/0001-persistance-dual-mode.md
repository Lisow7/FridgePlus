# 0001 — Persistance dual-mode (localStorage ↔ Supabase)

- Statut : accepté
- Date : 2026-06-22

## Contexte et problème
L'app doit fonctionner pour un **invité** (sans compte) ET pour un **utilisateur connecté**, en
conservant ses données (`stock`, `favorites`, recettes custom).

## Décision
- **Invité** : données persistées dans `localStorage` (clés `fridge-stock`, `fridge-favorites`,
  `fridge-custom-recipes`).
- **Connecté** : lecture/écriture dans **Supabase**.
- **Au login** : migration de localStorage → Supabase, orchestrée par `src/shared/lib/migration.js`.
- Logique de session : `src/app/hooks/use-user-session.js`, `src/shared/contexts/auth-provider.jsx`.

## Conséquences
- (+) Expérience continue invité → connecté sans perte de données.
- (−) **Deux flags de migration distincts** (`fridge-migration-done` pour stock+favs, et
  `fridge-migration-custom-recipes-done` pour les recettes custom). Raison documentée dans
  `migration.js` : avant v3.20.6 la migration ne couvrait que stock+favs ; un flag unique aurait
  empêché la migration custom (ajoutée plus tard) de se déclencher pour les users déjà migrés →
  **perte silencieuse** des recettes custom. Le flag dédié, indépendant, corrige ça. Migration
  **idempotente** (`onConflict: 'id'`), rejouable.
- ⚠️ Un nouveau dev qui touche au login/logout ou simplifie ces flags doit préserver les **deux**
  chemins de migration, sinon il réintroduit la perte de données. Tester invité→connecté.
