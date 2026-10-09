# Migrations Supabase Fridge+

> **Patrimoine versionné — NE JAMAIS supprimer une migration appliquée.**
>
> Cette doc liste les migrations livrées, groupées par domaine fonctionnel, avec leur objectif synthétique et les flags critiques de sécurité (RLS, SECURITY DEFINER, FK majeures). Elle sert de référence pour les revues d'audit externe et pour reconstruire mentalement l'historique du schéma.
>
> Photographie de la BDD à un instant T : `supabase/SCHEMA.md` (gitignored — confidentiel, à régénérer après chaque migration touchant le schéma).

## ⚠️ Workflow obligatoire (depuis Sprint 3 refonte BDD, 2026-05-17)

Tout changement de schéma BDD **DOIT** :

1. **Être appliqué via** `mcp__supabase__apply_migration` (MCP) ou `supabase db push` (CLI). **JAMAIS** via le Dashboard SQL Editor seul.
2. **Avoir son fichier `.sql`** versionné dans ce dossier.
3. **Apparaître dans `supabase_migrations.schema_migrations`** — `apply_migration` le fait automatiquement.

**Pourquoi** : avant le 17 mai 2026, 55+ migrations avaient été appliquées hors tracking. Risque : `supabase db push` ultérieur aurait tenté de rejouer toutes les non-trackées (CREATE TABLE échoue sur table existante). Le Sprint 3 (`20260517_db_refonte_s3_backfill_tracking.sql`) a backfillé 58 entrées via `ON CONFLICT DO NOTHING`. Tracking total après : **70 entrées**.

### Garde-fous

- **Atomicité** : `BEGIN; … COMMIT;` pour rollback automatique en cas d'erreur
- **Idempotence** : `IF NOT EXISTS` / `IF EXISTS` / `ON CONFLICT DO NOTHING`
- **`npm run db:types`** après chaque migration qui change le schéma (régénère `src/shared/types/database.ts`)
- **Vérification post-apply** : query SQL de validation (`SELECT COUNT(*) FROM ...`)

### Recovery snippet si drift détecté

```sql
-- Vérifier l'écart
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- Comparer avec : ls supabase/migrations/*.sql

-- Backfill ciblé (idempotent)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('<filename_sans_ext>', '<name>')
ON CONFLICT (version) DO NOTHING;
```

## ✅ Aucune migration en attente (état au 2026-08-13)

**Les deux dernières en attente ont été appliquées le 2026-08-13**, sous
supervision, l'une après l'autre, chacune vérifiée avant de passer à la suivante.
Le tableau ci-dessous garde leur historique — il documente deux remèdes d'audit
qui se sont révélés impossibles ou faux, ce qui vaut d'être conservé.

| Migration | Vérification post-application (2026-08-13) |
|---|---|
| `ai_cache_lecture_publique_restreinte` | anon voit **3 lignes `substitute`** et **0 `moderation`** (prouvé en transaction annulée avec une entrée de modération factice : 4 visibles avant, 3 après). Advisors **0 ERROR**, aucun nouveau WARN. |
| `plafond_serveur_tickets_ouverts` | 3 tickets acceptés, **4ᵉ refusé (42501)**, `service_role` et admin libres. Fonction, index partiel et policy présents ; `authenticated` a bien `EXECUTE`. |
| `guard_profiles_consentements` | auto-restore **passe**, `last_login_at` **passe**, `banner_id`/`username_confirmed` **passent**, réécriture de consentement **bloquée**, escalade de rôle **bloquée**, `service_role` libre. |

Les deux vérifications ont tourné dans un `DO` terminé par `RAISE EXCEPTION` :
**aucune donnée de test n'a été laissée en base** (contrôlé après coup — 1 ticket,
8 comptes, 0 compte soft-deleted, 0 jeton).

**Advisors Supabase : 0 ERROR.** Ni `private.compte_tickets_ouverts` ni le garde
n'apparaissent dans les WARN — le schéma `private` n'étant pas exposé, la
fonction n'est pas appelable en RPC (PostgREST rend 406 sur
`Content-Profile: private`).

⚠️ `npm run db:types` a été rejoué : **aucun changement de contenu** (seules des
fins de ligne réécrites). Attendu — rien de ce lot ne touche la forme des tables
ou vues de `public`.

## Historique — ces 2 migrations ont longtemps été « écrites mais NON APPLIQUÉES »

**Un fichier présent dans ce dossier n'est pas une preuve que la base l'a reçu.**
Vérifier avant de raisonner dessus :

```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```

| Fichier | État | Pourquoi |
|---|---|---|
| `20260808_guard_profiles_columns_restantes.sql` | ✅ **appliquée le 2026-08-13** (entrée `guard_profiles_consentements`) — RÉÉCRITE le 2026-08-12 | 🔴 La version du 8 août était **FAUSSE** : elle protégeait `deleted_at` et `restore_token` en UPDATE en affirmant qu'ils n'étaient jamais écrits par le client. Or `auth-provider.jsx:127-140` les écrit — c'est l'**auto-restore d'un compte soft-deleted** à la reconnexion dans les 30 jours. **Prouvé** par dry-run sur la base réelle : `AUTO-RESTORE = BLOQUÉ (42501)`, et l'échec aurait été **silencieux** (erreur journalisée sous `import.meta.env.DEV` seulement) ⇒ compte resté programmé pour purge. Ne restent donc que **2 colonnes** : `consent_terms_accepted_at`, `consent_privacy_accepted_at` — dry-run 6/6 conforme (auto-restore et `last_login_at` passent, réécriture de consentement et escalade de rôle bloquées, `service_role` libre). Garde-fou : `src/test/unit/guard-profiles-vs-ecritures-client.test.js`. |
| `20260812_plafond_serveur_tickets_ouverts.sql` | ✅ **appliquée le 2026-08-13** (entrée `plafond_serveur_tickets_ouverts`) | Plafond serveur de 3 tickets ouverts (revue du 2026-08-07, finding sécu n°3). **Prouvée par dry-run sur la base de production** le 2026-08-12, dans un `DO` terminé par `RAISE EXCEPTION` — donc intégralement annulé : 3 tickets acceptés, le 4ᵉ refusé, usurpation refusée, `service_role` et admin non bloqués, nouveau ticket accepté après résolution des 3. ⚠️ Deux impasses mesurées et documentées en tête du fichier : une sous-requête dans la policy **récurse** (42P17), et révoquer `EXECUTE` à `authenticated` casse tout (42501, `OR` sans court-circuit). La FK sur `target_id` demandée par l'audit est **impossible** — `target_id` est polymorphe sur 7 types. |
| `20260809_restaure_security_invoker_recipe_health_check.sql` | ✅ **appliquée le 2026-08-09** | Via `apply_migration` (entrée `restaure_security_invoker_recipe_health_check`). Advisors repassés à **0 ERROR**, admin vérifié à 515 recettes / 653 ingrédients. |

⚠️ **`base_recipes` porte `security_invoker=true` en base sans qu'aucune migration
ne la pose** — appliquée hors dépôt. Documentée en exception dans
`src/test/unit/migrations-view-security-invoker.test.js`.

## Légende

- 🔒 La migration crée ou modifie des policies RLS
- 🔑 La migration définit une fonction `SECURITY DEFINER`
- 🔗 La migration crée une FK majeure (impact relations)

## Conventions de nommage

`YYYYMMDD_<scope>_<action>.sql`

- `scope` = domaine fonctionnel (ex : `community`, `profile`, `admin`)
- `action` = ce que la migration fait (`create`, `extend`, `drop`, `rpc`, etc.)
- Une migration = un thème ; on n'agglomère pas plusieurs concerns dans le même fichier.

Toutes les migrations sont **idempotentes** (CREATE TABLE IF NOT EXISTS, ALTER TABLE … ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS avant CREATE POLICY).

---

## Auth & Profils

- `20260429_admin_auth_users.sql` — Créer fonction `admin_get_auth_users()` lisant emails et `last_sign_in_at` côté admin. 🔑
- `20260430_admin_rls_policies.sql` — Créer `is_admin()` SECURITY DEFINER (référence à `profiles.role = 'admin'`) + policies admin sur tables sensibles. 🔒🔑
- `20260430_profile_allergen_prefs.sql` — Garantir colonne `allergen_prefs` sur `profiles` pour le filtrage allergènes côté UI.
- `20260430_profile_password_changed_at.sql` — Ajouter `password_changed_at` (timestamp dernière modif du mot de passe).
- `20260430_profile_soft_delete.sql` — Implémenter soft-delete RGPD : `deleted_at` + `restore_token` 30 jours.
- `20260430_profile_username_unique.sql` — Index UNIQUE case-insensitive sur `profiles.username`.
- `20260503_extend_profiles_rgpd.sql` — Ajouter `language`, `last_login_at`, `consent_terms_accepted_at`, `consent_privacy_accepted_at` (preuves RGPD Art. 7).
- `20260503_community_terms.sql` — Ajouter `community_terms_accepted_at` (preuve d'acceptation de la charte communauté).

## Catalogue & ingrédients

- `20260429_ingredient_nutrition.sql` — Créer table `ingredient_nutrition` (catalogue read-only public). 🔒  
  *⚠ Initialement avec policy admin RLS bug (`is_admin` colonne, n'existe pas). Corrigée par `20260430_admin_rls_policies.sql`. Table droppée par `20260503_drop_legacy_tables.sql` (consolidée dans `ingredients.nutrition`).*
- `20260503_create_master_subcategories.sql` — Créer `ingredient_subcategories` (référentiel 47 lignes seedées). 🔒
- `20260503_create_master_difficulty_meal.sql` — Créer `difficulty_types` + `meal_types` (référentiels). 🔒
- `20260503_extend_ingredients.sql` — 5 colonnes BDD (`nutrition`, `pack_size`, `allergens[]`, `breaks_diets[]`, `default_unit`) + CHECK + 4 index + FK `subcategory`. 🔗
- `20260503_create_seasonal_months.sql` — Ajouter `seasonal_months smallint[]` sur `ingredients` (CHECK 1-12) pour le bouton « Recettes de saison ».

## Recettes (catalogue + custom)

- `20260501_data_migration_v3.sql` — Étendre `base_recipes` + ingrédients, créer tables maîtres `diet_types`, `allergen_types`, `countries_master`, `recipe_tags`, `fridge_layouts`. 🔗  
  *⚠ `recipe_tags` créée mais jamais utilisée → droppée par `20260503_drop_legacy_tables.sql`.*
- `20260503_extend_base_recipes.sql` — 3 colonnes auteur (`original_author_id`, `promoted_from_custom_id`, `promoted_at`) + 4 FK (country, difficulty, type, subcategory) + 4 index + vue `recipe_health_check` + recréation de `promote_recipe_to_base` (signature `text` au lieu de `uuid` — corrige incompatibilité FK). 🔗🔑
- `20260502_promote_recipe_to_base.sql` — Première version de la RPC promotion. 🔑  
  *⚠ Signature `uuid` cassée vs FK `text`. Superseded par `20260503_extend_base_recipes.sql`.*
- `20260502_recipe_consent_to_promote.sql` — Ajouter `consent_to_promote` sur `custom_recipes` (RGPD : auteur doit consentir explicitement à la promotion).
- `20260502_recipe_deletion_rgpd.sql` — RPC `delete_custom_recipe_rgpd(uuid)` + helper `count_recipe_references(text)`. Vérifie owner OU admin avant action. 🔑

## Communauté (posts, replies, likes)

- `20260503_create_community.sql` — Créer `community_posts` + `community_replies` + `community_likes` avec RLS (public read si `deleted_at IS NULL`, owner write, anti-spam via fonctions). 🔒🔑🔗
- `20260503_community_reply_threading.sql` — Ajouter `parent_reply_id` (auto-référence) + `community_reply_likes` + triggers compteurs. 🔗
- `20260503_community_moderation.sql` — Ajouter `community_muted_until` + `deleted_by_admin` + 5 RPCs admin (soft-delete post, hard-delete post, soft-delete reply, set mute, etc.). 🔒🔑

## Avis recettes

- `20260503_create_recipe_reviews.sql` — Créer `recipe_reviews` (1-5 étoiles + commentaire) avec RLS (public read si non-supprimé, owner write, soft-delete admin protégé). 🔒
- `20260503_admin_review_moderation.sql` — RPCs `admin_review_soft_delete(uuid)` + `admin_review_hard_delete(uuid)`. 🔑

## Cuisine (logs, mode cuisine)

- `20260503_create_cooking_logs.sql` — Créer `cooking_logs` (journal des recettes cuisinées : `cooked_at` + servings) avec RLS user-only. 🔒

## Panier

- `20260429_basket_items.sql` — Créer `basket_items` (panier persistant côté BDD) avec RLS user-only stricte. 🔒
- `20260429_user_leftovers.sql` — Créer `user_leftovers` (compartiment Restes du frigo) avec RLS user-only. 🔒
- `20260503_basket_manual_add.sql` — DROP NOT NULL sur `recipe_id`/`recipe_name`/`recipe_emoji` pour permettre l'ajout manuel d'ingrédients hors recette (v3.27.1).
- `20260503_basket_servings_stepper.sql` — Ajouter `recipe_servings`, `recipe_servings_initial`, `amount_initial` pour le stepper personnes (v3.27.4).
- `20260504_basket_servings_stepper.sql` — Trigger backfill historique pour les colonnes ajoutées (v3.27.4 cont.).
- `20260505_basket_nullable_v3_59_0.sql` — Re-applique idempotemment DROP NOT NULL sur `recipe_id`/`recipe_name`/`recipe_emoji` (la migration v3.27.1 n'avait pas été déployée en prod, INSERTs basket cassés en 400).

## Notifications

- `20260502_notifications.sql` — Créer `notifications` + 3 triggers SECURITY DEFINER (`notify_ticket_reply`, `notify_recipe_submitted`, `notify_recipe_status_changed`). RLS : recipient owner ou admin broadcast. INSERT bloqué côté client (`WITH CHECK (false)` — uniquement via triggers). 🔒🔑🔗

## Support tickets & signalements

- `20260503_create_reports.sql` — Créer table `reports` (signalements par target_type/target_id). 🔒  
  *⚠ Consolidée dans `support_tickets` (cf. ci-dessous).*
- `20260503_consolidate_reports_into_support_tickets.sql` — DROP `reports` + ajout colonnes `target_type`, `target_id`, `reason_key` sur `support_tickets`. Décision : un seul flux unifié pour réduire la dette UI.
- `20260501_admin_user_favorites_rls.sql` — Policy SELECT admin sur `user_favorites` (consultation profils utilisateurs).

## Audit & RGPD

- `20260501_activity_logs_append_only.sql` — RLS append-only : admin SELECT + INSERT, UPDATE et DELETE = `USING (false)` (Art. 30 RGPD : audit log inviolable). 🔒
- `20260502_activity_logs_metadata.sql` — Ajouter colonne `metadata jsonb` sur `activity_logs` pour metadata structurée auditable.
- `20260503_rpc_anonymize_user.sql` — RPC atomique `anonymize_user(uuid)` SECURITY DEFINER (admin OU self), réutilisable par pg_cron purge inactifs. 🔑
- `20260503_pg_cron_purges.sql` — 4 jobs cron RGPD : purge notifications lues 6m/non-lues 12m, tickets résolus 24m, soft-delete profiles 30j. 🔑

## Schéma — housekeeping

- `20260503_drop_legacy_tables.sql` — DROP `recipe_tags` (jamais utilisée — créée par erreur en `20260501_data_migration_v3.sql`) + DROP `ingredient_nutrition` (consolidée dans `ingredients.nutrition`).

---

## Synthèse audit sécurité (réalisée 2026-05-03)

Audit complet effectué dans le cadre de la **Vague 2 — v3.19.0** (Phase 8.5 audit pré-launch).

### ✅ Vérifications positives

- **RLS** : 100 % des tables `public.*` créées par migration ont `ENABLE ROW LEVEL SECURITY` — aucune table avec RLS désactivée.
- **Policies** : aucune `USING (true)` non justifiée. Les seuls `USING (true)` portent sur des catalogues publics read-only (`difficulty_types`, `meal_types`, `ingredient_subcategories`, `diet_types`, `allergen_types`, `countries_master`, `community_likes` pour le compteur public).
- **SECURITY DEFINER** : les 14 fonctions `SECURITY DEFINER` actives vérifient toutes l'autorisation (`is_admin()` ou équivalent owner-OR-admin) **dans les premières lignes du corps**.
- **Activity logs append-only** : UPDATE/DELETE = `USING (false)` strict — Art. 30 RGPD respecté.
- **Notifications** : INSERT côté client bloqué (`WITH CHECK (false)`) — insertions uniquement via triggers DEFINER serveur.
- **Aucun `GRANT ALL TO PUBLIC`** : seul `GRANT EXECUTE` ciblé sur `authenticated` pour des fonctions publiques.
- **ON DELETE CASCADE / SET NULL** appliqués correctement pour cascades user et anonymisation auto.

### ⚠️ Anomalies historiques (déjà corrigées)

| # | Anomalie | Migration source | Correction |
|---|---|---|---|
| 1 | Policy `ingredient_nutrition` référençait `is_admin` colonne (n'existe pas, seul `role` existe sur `profiles`) | `20260429_ingredient_nutrition.sql` | DROP + recréée avec `is_admin()` fonction par `20260430_admin_rls_policies.sql`. Table droppée définitivement par `20260503_drop_legacy_tables.sql`. |
| 2 | Signature `promote_recipe_to_base(uuid)` incompatible avec FK `promoted_from_id text` | `20260502_promote_recipe_to_base.sql` | Recréée en `text` par `20260503_extend_base_recipes.sql`. |

### Liste des fonctions SECURITY DEFINER (état actuel)

| Fonction | Migration | Auth check |
|---|---|---|
| `is_admin()` | `20260430_admin_rls_policies.sql` | Vérifie `role = 'admin'` sur `profiles` |
| `admin_get_auth_users()` | `20260429_admin_auth_users.sql` | Vérifie `role = 'admin'` |
| `promote_recipe_to_base(text)` | `20260503_extend_base_recipes.sql` | `IF NOT public.is_admin() THEN RAISE EXCEPTION` |
| `delete_custom_recipe_rgpd(uuid)` | `20260502_recipe_deletion_rgpd.sql` | Owner OR admin check |
| `admin_review_soft_delete(uuid)` | `20260503_admin_review_moderation.sql` | `is_admin = true` check |
| `admin_review_hard_delete(uuid)` | `20260503_admin_review_moderation.sql` | `is_admin = true` check |
| `admin_community_soft_delete_post(uuid)` | `20260503_community_moderation.sql` | `is_admin = true` check |
| `admin_community_hard_delete_post(uuid)` | `20260503_community_moderation.sql` | `is_admin = true` check |
| `admin_community_soft_delete_reply(uuid)` | `20260503_community_moderation.sql` | `is_admin = true` check |
| `admin_community_set_mute(uuid, timestamptz)` | `20260503_community_moderation.sql` | `is_admin = true` check |
| `community_can_post(uuid)` | `20260503_community_moderation.sql` | N/A (fonction de check, pas d'action) |
| `community_can_reply(uuid)` | `20260503_community_moderation.sql` | N/A (idem) |
| `notify_ticket_reply()` | `20260502_notifications.sql` | Vérifie `NEW.is_admin` (trigger interne) |
| `notify_recipe_submitted()` | `20260502_notifications.sql` | Vérification métier `moderation_status = 'pending'` |
| `notify_recipe_status_changed()` | `20260502_notifications.sql` | Vérification métier sur status change |
| `anonymize_user(uuid)` | `20260503_rpc_anonymize_user.sql` | Admin OR self check |
| `_reschedule_cron(text, text, text)` | `20260503_pg_cron_purges.sql` | Helper privé, non exposé authenticated |
| `count_recipe_references(text)` | `20260502_recipe_deletion_rgpd.sql` | N/A (lecture seule, pas de PII) |

---

## Tables historiques créées via Dashboard Supabase (pas via migration)

Ces tables ont été créées avant que le workflow migrations soit en place. Elles existent en prod mais ne sont pas reproductibles via le dossier `supabase/migrations/` seul.

| Table | Domaine | Note |
|---|---|---|
| `profiles` | Auth | Liée 1:1 à `auth.users` (trigger `handle_new_user`). Étendue par 5 migrations ultérieures. |
| `custom_recipes` | Recettes | Création utilisateur. Étendue par `recipe_consent_to_promote`. |
| `activity_logs` | Audit | RLS append-only ajoutée par migration ultérieure. |
| `user_stock` | Frigo | RLS user-own simple. |
| `user_favorites` | Favoris | Policy admin SELECT ajoutée par migration ultérieure. |
| `support_tickets` | Support | Étendue par `consolidate_reports_into_support_tickets`. |
| `support_messages` | Support | Trigger `notify_ticket_reply` ajouté par migration. |
| `base_recipes` | Catalogue | Étendue massivement par `extend_base_recipes` (4 FK + auteur). |
| `ingredients` | Catalogue | Étendue massivement par `extend_ingredients` (5 colonnes). |

> 📝 **TODO post-launch** : générer des baselines `pg_dump --schema-only --table=public.<nom>` documentaires, à archiver dans `supabase/migrations/baseline/` (ou équivalent). Décidé de différer à post-launch — la photographie complète est déjà disponible dans `supabase/SCHEMA.md` (gitignored), suffisante pour audit interne.

---

## Vérifications live (exécutées 2026-05-03)

### 1. Toutes les tables publiques ont RLS activé ?

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
```

**Résultat** : ✅ 0 ligne — **100 % des 25 tables publiques ont RLS activé**.

### 2. Index recommandés présents ?

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Résultat** : ✅ **Tous les index attendus sont présents en prod**, en particulier :

| Table | Index versionné présent |
|---|---|
| `base_recipes` | `pkey`, `idx_base_recipes_allergens` (GIN), `idx_base_recipes_country`, `idx_base_recipes_diet` (GIN), `idx_base_recipes_promoted_from`, `idx_base_recipes_status` |
| `notifications` | `pkey`, `idx_notifications_admin_broadcast`, `idx_notifications_expires`, `idx_notifications_recipient_unread` |
| `recipe_reviews` | `pkey`, `recipe_reviews_user_id_recipe_id_key` (UNIQUE), `idx_recipe_reviews_recipe`, `idx_recipe_reviews_user` |
| `community_posts`, `community_replies`, `community_reply_likes`, `community_likes` | Tous les index PARTIAL `WHERE deleted_at IS NULL` + parent_reply_id présents |
| `profiles` (table ex-Dashboard, étendue par 5 migrations) | `pkey`, `username_unique`, `role`, `allergen_prefs` (GIN), `deleted_at` (PARTIAL), `restore_token` (PARTIAL), `community_muted` (PARTIAL), `last_login_at` (PARTIAL) |
| `support_tickets` | `pkey`, `idx_support_tickets_target` (PARTIAL), `idx_support_tickets_reason_key` (PARTIAL) |
| `ingredients` | `pkey`, `subcategory`, `storage`, `allergens` (GIN), `breaks_diets` (GIN) |
| Référentiels (`diet_types`, `allergen_types`, `countries_master`, `difficulty_types`, `meal_types`, `ingredient_subcategories`, `fridge_layouts`) | PK + clés naturelles UNIQUE |
| `user_*` (stock, favorites, leftovers) | PK + `user_id_idx` + UNIQUE composites |
| `cooking_logs`, `basket_items`, `activity_logs`, `custom_recipes` | Index sur user_id + DESC sur date |

**Aucune migration corrective nécessaire** au moment de l'audit.

### 3. Conclusion

✅ **BDD prête pour le launch côté sécurité et perf.** Vérifier à nouveau ces 2 queries après chaque nouvelle migration touchant le schéma.
