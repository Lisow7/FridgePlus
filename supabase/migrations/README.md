# Migrations Supabase Fridge+

> **Patrimoine versionné — NE JAMAIS supprimer une migration appliquée.**
>
> Cette doc liste les migrations livrées, groupées par domaine fonctionnel, avec leur objectif synthétique et les flags critiques de sécurité (RLS, SECURITY DEFINER, FK majeures). Elle sert de référence pour les revues d'audit externe et pour reconstruire mentalement l'historique du schéma.
>
> Photographie de la BDD à un instant T : `supabase/SCHEMA.md` (gitignored — confidentiel, à régénérer après chaque migration touchant le schéma).

## ⚠️ Workflow obligatoire (depuis Sprint 3 refonte BDD, 2026-05-17)

Tout changement de schéma BDD **DOIT** :

1. **Être appliqué via** `mcp__supabase__apply_migration` (MCP). **JAMAIS** via le Dashboard SQL Editor seul, ni par `supabase db push` : le CLI identifie une migration par son préfixe, et les anciens fichiers en partagent (jusqu'à 21 pour un même jour) — il les confondrait (audit ARCH-10).
2. **Avoir son fichier `.sql`** versionné dans ce dossier, nommé `<version>_<nom>.sql` avec la **version complète que `apply_migration` inscrit** (`AAAAMMJJHHMMSS`, 14 chiffres, heure UTC) et le **même nom** qu'au registre. Le test `migrations-alignees` refuse un nouveau nom à la date seule.
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

## 🔗 Registre et dépôt (état au 2026-10-08)

Audit du 2026-10-04, BDD-19 / ARCH-10 : 9 entrées du registre n'avaient pas de
fichier. Elles ont été **reconstituées** le 2026-10-08 depuis la colonne
`statements` du registre : chaque fichier `AAAAMMJJHHMMSS_<nom>.sql` recopie le
SQL appliqué **à l'octet près**, sous une ligne-repère qui porte son empreinte
md5 — le test `migrations-alignees` refuse qu'il bouge d'un octet.

**Aujourd'hui : 159 entrées, toutes avec leur fichier** (la dernière :
`20261008095232_consultations_sensibles_tracees.sql`). Les entrées d'avant le
2026-05-16 n'ont que leur nom (rattrapées par
`20260517_db_refonte_s3_backfill_tracking.sql`) : leur fichier est le seul
texte qui en reste.

**17 fichiers n'ont pas d'entrée homonyme**, et c'est attendu :

| Fichier | État (vérifié en lecture seule le 2026-10-08, sinon par l'audit) |
|---|---|
| `20260518_db_refonte_s5d_recipes_compat_views.sql` | Appliqué hors registre : les vues `base_recipes` et `custom_recipes` existent. |
| `20260518_db_refonte_s5e_drop_legacy_recipes.sql` | Appliqué hors registre : `*_legacy` n'existent plus. |
| `20260518_db_refonte_s7b_dedup_support_policies.sql`, `…_s7c_revoke_security_definer_rpcs.sql`, `…_s7d_consolidate_permissive_policies.sql` | Appliqués hors registre (effets constatés par l'audit BDD-19). |
| `20260613_recipe_publish_consent.sql` | Remplacé : son en-tête renvoie à `fix_recipe_view_consent_aimod` (au registre). |
| `20260616_custom_recipes_security_invoker.sql` | Même effet que `20260614224201_restore_custom_recipes_security_invoker.sql` (au registre) : la vue est en `security_invoker`. |
| `20260622_fix_orphan_vg_avocat.sql` | Appliqué hors registre : plus aucune recette ne cite `vg-avocat`. |
| `20260626_add_recipe_countries.sql` | Appliqué hors registre : 15 pays en `taxonomies`. |
| `20260701_disable_expiry_alert_cron.sql` | Appliqué hors registre : la tâche de péremption n'est plus active. |
| `20260706_drop_base_recipes_bak.sql` | Même effet que `20260706010139_drop_base_recipes_bak_20260701.sql` (au registre). |
| `20260708_receipt_scan_feature_flag.sql` | Appliqué hors registre : le drapeau `receipt_scan` existe. |
| `20260808_guard_profiles_columns_restantes.sql` | Appliqué le 2026-08-13 sous le nom `guard_profiles_consentements` (fichier `20260813111101_…`). Son en-tête disait « non appliquée » : corrigé. |
| `20261005_regle_du_pseudo_tenue_par_la_base.sql`, `20261006_allergenes_contrainte_apres_release.sql`, `20261008_retrait_admin_get_auth_users_apres_release.sql` | **En attente de release**, exprès : voir la section suivante. |
| `20261008_droits_en_base.sql`, `20261008_index_pseudo_en_double.sql` | **En attente de la confirmation d'Antoine** (essai à blanc puis `apply_migration`, qu'il confirme) : voir « En attente d'Antoine » plus bas. |
| `20261009130000_opposition_au_profilage_en_base.sql` | **En attente de la confirmation d'Antoine** (essai à blanc par sa sonde, puis `apply_migration`, qu'il confirme) : voir « En attente de la confirmation d'Antoine » plus bas. |

**Rejouer le rapprochement** (le registre ne se lit pas depuis la CI) : copier la
sortie de la requête ci-dessous dans un fichier, puis
`node scripts/verifier-migrations.mjs registre.txt` — il liste les entrées sans
fichier (code de sortie 1) et les fichiers sans entrée.

```sql
select string_agg(regexp_replace(name, '^\d{8}_', ''), ' ' order by version)
from supabase_migrations.schema_migrations;
```

**Reconstituer un fichier manquant** : `select version, name, statements[1],
md5(statements[1]) from supabase_migrations.schema_migrations where name = '…'`,
recopier le SQL sous la ligne-repère (modèle : n'importe quel fichier à
14 chiffres), puis lancer le test `migrations-alignees`.

## ⏳ Trois migrations en attente de release (état au 2026-10-08)

| Migration | Pourquoi elle attend | Quand l'appliquer |
|---|---|---|
| `20261008_retrait_admin_get_auth_users_apres_release.sql` | Seconde moitié de `consultations_sensibles_tracees` (au registre, 20261008095232) : retire le droit d'appel à `admin_get_auth_users`, qui rapatrie les e-mails et dernières connexions de TOUS les comptes sans trace (audit ADM-05). La v0.145 en production l'appelle encore à l'ouverture de l'onglet Utilisateurs. | Juste après la mise en production de la version qui passe par `admin_reveler_compte`. Avant : `git grep -n "admin_get_auth_users" -- src supabase/functions` ne doit rien rendre. Après : rejouer sa sonde (2 sur 2 attendus) et renommer le fichier à sa version. |
| `20261006_allergenes_contrainte_apres_release.sql` | Seconde moitié de `allergenes_avec_accord` (au registre) : la base refusera tout allergène enregistré sans accord. Avant la release, l'écran en production enregistre encore des allergènes sans demander l'accord. | Juste après la mise en production de la version qui demande l'accord (décision du 2026-10-06, « allergènes = case »). Lire son en-tête avant de l'appliquer. |
| `20261005_regle_du_pseudo_tenue_par_la_base.sql` | Elle fait refuser par la base un pseudo hors règle ou réservé. L'écran « Choisis ton pseudo » de la v0.145 (en production) ne contrôle que la longueur : il répondrait « Impossible d'enregistrer » à « Zoé » sans dire pourquoi. | Juste après la mise en production de la version qui contient `src/shared/lib/auth/username-rules.js`. Essai à blanc déjà joué le 2026-10-04 (0 écart avec la précédente). Après application, rejouer `supabase/probes/20261004_inscription_sans_impasse.sql` : 0 écart attendu, puis mettre cette section à jour. |

## ⏳ Deux migrations en attente de la confirmation d'Antoine (état au 2026-10-08)

Compatibles avec la v0.145 en production : elles n'attendent PAS la release, seulement Antoine, qui confirme
l'essai à blanc (bloc `DO` de la sonde) puis `apply_migration`. Ensuite : sonde « après », renommer le fichier à
sa version (14 chiffres), compléter les RÉSULTATS de la sonde.

| Migration | Ce qu'elle fait | Vérifié avant (2026-10-08, lecture seule) |
|---|---|---|
| `20261008_droits_en_base.sql` | Retire à `anon` l'exécution d'`admin_delete_notification_batch` (BDD-16), la lecture de `feature_flags.updated_by` (BDD-18 (4)) et celle d'`ai_cache` (BDD-21 (4)) ; garde ce qui sert (l'admin, la lecture des bascules, le serveur). Sonde : `supabase/probes/20261008_droits_en_base.sql`. | Prod v0.145 et dev : `admin_delete_notification_batch` appelée connecté ; bascules lues par `key, enabled, label, description` ; `ai_cache` jamais lue côté client. |
| `20261008_index_pseudo_en_double.sql` | Retire `profiles_username_lower_idx`, index UNIQUE créé par aucune migration du dépôt, en double de `profiles_username_unique_lower` (décision du 2026-10-08, `index_double = oui`). Sonde : `supabase/probes/20261008_index_pseudo_en_double.sql`. | Les deux index existent ; le client ne lit que le code 23505. |
## ⏳ Une migration en attente de la confirmation d'Antoine (état au 2026-10-09)

Compatible avec la v0.145 en production : elle n'attend PAS la release, seulement Antoine, qui confirme
l'essai à blanc (bloc `DO` de la sonde) puis `apply_migration`. Ensuite : sonde « après », renommer le fichier à
sa version (14 chiffres), compléter les RÉSULTATS de la sonde.

| Migration | Ce qu'elle fait | Vérifié avant (2026-10-09, lecture seule) |
|---|---|---|
| `20261009130000_opposition_au_profilage_en_base.sql` (version provisoire = heure d'écriture, exigée à 14 chiffres par `migrations-alignees` ; à renommer à la version qu'inscrira `apply_migration`) | La règle d'insertion de `spending_events` refuse une dépense enregistrée contre l'opposition au profilage (`NOT is_profiling_opted_out(auth.uid())`) : jusqu'ici seule l'application la vérifiait, et une RPC en échec laissait passer l'écriture (audit du 2026-10-04, RGPD-18 (a)). Le client traite le refus 42501 comme une dépense « sautée ». | La règle vaut `user_id = (select auth.uid())` seul ; `is_profiling_opted_out` est SECURITY INVOKER, STABLE. Sonde : `supabase/probes/20261009_opposition_au_profilage_en_base.sql`. |

## ✅ Aucune autre migration en attente (état au 2026-08-13)

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
**aucune donnée de test n'a été laissée en base** (contrôlé après coup).

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

`AAAAMMJJHHMMSS_<nom>.sql` — la version complète que `apply_migration` inscrit, et le même nom qu'au registre (depuis le 2026-10-08 ; les fichiers plus anciens, à la date seule `AAAAMMJJ_<nom>.sql`, restent tels quels).

- `scope` = domaine fonctionnel (ex : `community`, `profile`, `admin`)
- `action` = ce que la migration fait (`create`, `extend`, `drop`, `rpc`, etc.)
- Une migration = un thème ; on n'agglomère pas plusieurs concerns dans le même fichier.

Toutes les migrations sont **idempotentes** (CREATE TABLE IF NOT EXISTS, ALTER TABLE … ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS avant CREATE POLICY).

---

## Auth & Profils

- `20260429_admin_auth_users.sql` — Créer fonction `admin_get_auth_users()` lisant emails et `last_sign_in_at` côté admin. 🔑 Remplacée par `admin_reveler_compte` (un compte, tracé) le 2026-10-08 ; son droit d'appel se retire après la release (voir « en attente de release »).
- `20261005_bannissement_reel.sql` — **Appliquée le 2026-10-05** (`bannissement_reel`). Audit CPT-17 et complément de BDD-02. `profiles.banned_reason` (300 caractères) et `profiles.banned_until` (NULL = sans fin), que le compte ne peut pas écrire (`trg_garder_le_bannissement`). `admin_bannir(compte, motif, jours)` (admin seulement, ni soi-même ni un admin, motif obligatoire refusé au-delà de 300 caractères, 1 à 3 650 jours ou sans fin) pose le bannissement, l'inscrit dans le service d'authentification (`auth.users.banned_until` : la fin, ou dans 100 ans pour « sans fin »), coupe les sessions (jetons de renouvellement et traces MFA en cascade) et écrit au journal ; `admin_debannir(compte)` défait tout. Un bannissement daté prend fin à sa date : `compte_peut_ecrire()` et `ouvrir_ticket` regardent `banned_until`, et `lever_les_bannissements_echus` (cron, tous les quarts d'heure) remet le drapeau à faux et l'écrit au journal. Le bouton « Bannir » du panneau n'appelle pas encore `admin_bannir` : la fenêtre (motif, durée) attend l'avis d'Antoine sur maquette. Preuve : `supabase/probes/20261005_bannissement_reel.sql` (avant 26 écarts ; essai à blanc puis après : 0 écart sur 26 gestes). 🔒🔑
- `20261006_bannis_ne_se_reinscrivent_pas.sql` — **Appliquée le 2026-10-06** (`bannis_ne_se_reinscrivent_pas`). Note d'Antoine sur la planche (lot 3c-3b) : une personne bannie qui supprime son compte ne se réinscrit pas avec la même adresse. `private.adresses_interdites` garde l'EMPREINTE (sha256 de l'adresse en minuscules, espaces ôtés) — jamais l'adresse — d'un compte effacé pendant son bannissement, jusqu'à la fin de celui-ci (NULL = sans fin ; 3 ans au plus depuis la migration suivante). Deux déclencheurs sur `auth.users` : `garder_l_adresse_d_un_banni` (BEFORE DELETE : lit `profiles` avant la cascade ; la décision est dans `private.retenir_l_empreinte`, essayable à blanc) et `refuser_une_adresse_interdite` (BEFORE INSERT OR UPDATE OF email ; une adresse inchangée ne se contrôle pas, car le service d'authentification réécrit la ligne à chaque connexion). Le refus remonte au navigateur en « Database error saving new user ». Ne couvre pas une autre adresse. ⚠️ La suppression « douce » de GoTrue (`shouldSoftDelete`) passerait par un UPDATE et contournerait le déclencheur : la seule voie du code est l'effacement dur de `purge-soft-deleted-accounts`. **Retour arrière** (si les inscriptions échouent) : `CREATE OR REPLACE FUNCTION private.refuser_une_adresse_interdite() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$ BEGIN RETURN NEW; END; $$;` — ou `DROP TRIGGER refuser_une_adresse_interdite ON auth.users` (permis à `postgres`). **Lever une interdiction** (support, demande vérifiée depuis l'adresse) : `DELETE FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('adresse@exemple.fr');`. RGPD : une empreinte d'adresse reste une donnée personnelle ; sa durée pour un bannissement « sans fin » a été tranchée le 2026-10-06 : 3 ans au plus (`20261006_durees_de_conservation_tenues.sql`). Le schéma `private` n'est pas dans les types générés : `npm run db:types` n'a rien à changer. Preuve : `supabase/probes/20261006_bannis_ne_se_reinscrivent_pas.sql` (essais à blanc, puis après application : 0 écart sur 21 gestes). 🔒
- `20261006_allergenes_avec_accord.sql` — **Appliquée le 2026-10-06** (`allergenes_avec_accord`, version 20261006114940). Décision du 2026-10-06, choix d'Antoine (« allergenes = case », RGPD art. 9.2.a). `profiles.allergen_consent_at` (date de l'accord) ; déclencheur `trg_garder_l_accord_allergenes` (`private.garder_l_accord_allergenes`, SECURITY DEFINER, `BEFORE INSERT OR UPDATE OF allergen_consent_at`) : pour un compte qui écrit son propre profil, la date se pose « maintenant » (à une minute près) ou se retire (NULL), jamais antidatée ni changée — admin et serveur passent ; `accepter_l_enregistrement_des_allergenes()` (pose la date une fois, la rend) et `retirer_l_accord_allergenes()` (efface allergènes ET date), SECURITY INVOKER, comptes seulement. Sans effet sur la version en production (elle n'écrit jamais la date). **Retour arrière** : DROP TRIGGER + DROP FUNCTION des trois fonctions ; la colonne peut rester. `database.ts` mis à jour à la main. Preuve : `supabase/probes/20261006_allergenes_avec_accord.sql` (avant 13 écarts sur 14 ; essais à blanc puis après : 0 sur 11). 🔒
- `20261006_allergenes_contrainte_apres_release.sql` — **🔴 À APPLIQUER JUSTE APRÈS LA RELEASE** (pas avant : l'ancienne version écrit les allergènes sans accord). Contrainte `profiles_allergenes_avec_accord` : aucun allergène enregistré sans accord. Avant d'appliquer, compter les comptes « allergènes sans accord » : 0 → appliquer ; sinon, demander à Antoine avant d'effacer. Sonde : `supabase/probes/20261006_allergenes_contrainte_apres_release.sql`.
- `20261006_durees_de_conservation_tenues.sql` — **Appliquée le 2026-10-06** (`durees_de_conservation_tenues`, version 20261006105016). Décision du 2026-10-06, choix d'Antoine (« purge_usage = oui », « ban_sans_fin = 3_ans ») ; audit RGPD-01, BDD-11. (1) `private.retenir_l_empreinte` : l'empreinte d'un compte effacé pendant son bannissement vit jusqu'à la fin de celui-ci, **3 ans au plus** (un bannissement « sans fin » en donnait une sans fin) ; `jusqu_au` devient NOT NULL. (2) Tâche `purge_adresses_interdites_echues` (4 h 25 UTC) : les empreintes échues, qui n'interdisaient plus rien, sont effacées. (3) Tâche `purge_product_events_13_mois` (4 h 35 UTC) : les statistiques d'usage sont effacées 13 mois après `occurred_at`, la durée que la politique annonce (au 2026-10-06 : 1 135 lignes, la plus ancienne du 1er juillet, rien d'effacé avant août 2027). Le refus à l'inscription n'est pas touché. **Retour arrière** : `cron.unschedule` des deux tâches, l'ancienne `retenir_l_empreinte` (migration précédente), `ALTER COLUMN jusqu_au DROP NOT NULL`. Schéma `private` et `product_events` inchangés pour les types : `npm run db:types` n'a rien à changer. Preuve : `supabase/probes/20261006_durees_de_conservation_tenues.sql` (avant 10 écarts sur 13 ; essai à blanc composé par script puis après application : 0 sur 12). 🔒
- `20261008_comptes_jamais_confirmes.sql` — **Appliquée le 2026-10-08** (`comptes_jamais_confirmes`, version 20261007231333). Décision du 2026-10-07, choix d'Antoine (« non_confirmes = 30_jours »). `private.effacer_les_comptes_jamais_confirmes()` (SECURITY DEFINER, `search_path` vide, révoquée pour `PUBLIC`, `anon`, `authenticated`) efface un compte jamais confirmé, jamais connecté, créé il y a plus de 30 jours et sans aucune donnée (frigo, favoris, restes, listes, panier, journal de cuisine, demandes, partages, push, dépenses, mouvements, publications, réponses) ; une contrainte qui s'y opposerait laisse ce compte et passe au suivant. Tâche `effacer_comptes_jamais_confirmes` (chaque jour, 4 h 30 UTC). Essai à blanc puis sonde après application : 11/11 (six comptes fictifs en `.invalid`, tout annulé). Au 2026-10-07 : aucun compte concerné. Sonde : `supabase/probes/20261008_comptes_jamais_confirmes.sql`.
- `20261008_anonymisation_qui_tient.sql` — **Appliquée le 2026-10-08** (`anonymisation_qui_tient`, version 20261007234548). Audit BDD-06 (lot 4) et complément du 2026-10-06. Avant : `anonymize_user` donnait à tous le pseudo « utilisateur-supprimé » — au 2e compte, 23505 (unicité), et la tâche nocturne (un `DO` sans `EXCEPTION`) s'arrêtait pour tout le monde ; bio, pays, allergènes, budgets et bannière restaient ; son contrôle laissait passer sans appelant. Désormais `private.anonymiser_le_compte(cible, demandeur)` (pseudo unique `suppr-` + 14 caractères de l'identifiant, données vidées, journal), `public.anonymize_user` au contrôle fermé (`IS NOT TRUE`), et `private.anonymiser_les_comptes_supprimes()` (un compte à la fois, un échec n'arrête plus les autres) appelée par la tâche `anonymize_soft_deleted_profiles` (3 h 30 UTC). Voie (b) du constat, sans `DROP INDEX` ; l'index d'unicité en double reste à retirer avec l'accord d'Antoine. Avant/essai à blanc/après : 23505 au 2e compte / 12/12 / 12/12. Sonde : `supabase/probes/20261008_anonymisation_qui_tient.sql`.
- `20261008_echecs_des_taches_au_journal.sql` — **Appliquée le 2026-10-08** (`echecs_des_taches_au_journal`, version 20261008000755). Relecture du même jour : en traitant chaque compte à part, les deux migrations précédentes avaient rendu leurs échecs silencieux (`RAISE WARNING`, `NULL`), la tâche se disant réussie chaque nuit. Désormais un compte qui résiste laisse au journal d'activité une ligne `account_anonymization_failed` ou `unconfirmed_account_kept` (compte, code SQL, message tronqué), nommée dans l'onglet Journal de l'admin ; l'effacement des comptes jamais confirmés attrape tout échec, pas seulement `foreign_key_violation`. Avant/essai à blanc/après : aucune trace / 8/8 / 8/8. Sonde : `supabase/probes/20261008_echecs_des_taches_au_journal.sql`.
- `20261008_bascules_au_journal.sql` — **Appliquée le 2026-10-08** (`bascules_au_journal`, version 20261008013740). Audit ADM-04 (lot 12a) : basculer un drapeau (`feature_flags.enabled`) agit tout de suite pour tous les visiteurs et ne laissait aucune trace. Le déclencheur `trg_journaliser_la_bascule` (AFTER UPDATE OF enabled, seulement si l'état change) écrit par `private.journaliser_la_bascule()` une ligne `feature_flag_toggled` au journal d'activité : le compte qui a basculé (NULL depuis l'éditeur SQL), la clé et le nouvel état. Écrit par la base, donc vu d'où que vienne la bascule (recommandation d'ADM-06). Pas de `DROP` (`CREATE OR REPLACE TRIGGER`). Avant/essai à blanc/après : aucune trace / 5/5 / 5/5. Sonde : `supabase/probes/20261008_bascules_au_journal.sql`.
- `20261008_acces_special_sans_fonctions_mortes.sql` — **Appliquée le 2026-10-08** (`acces_special_sans_fonctions_mortes`, version 20261008022949). Audit ADM-13 (lot 12c) : `grant_comped_access` et `clear_special_access_note` n'ont plus d'appelant (leurs enveloppes JS sont retirées ; effacer une note passe par `grant_special_access`). Le droit d'exécution leur est retiré pour PUBLIC, `anon` et `authenticated` ; `service_role` le garde, rien n'est supprimé, le retour arrière est un GRANT. Avant/essai à blanc/après : tout compte pouvait les exécuter / 4/4 / 4/4. Sonde : `supabase/probes/20261008_acces_special_sans_fonctions_mortes.sql`.
- `20260430_admin_rls_policies.sql` — Créer `is_admin()` SECURITY DEFINER (référence à `profiles.role = 'admin'`) + policies admin sur tables sensibles. 🔒🔑
- `20260430_profile_allergen_prefs.sql` — Garantir colonne `allergen_prefs` sur `profiles` pour le filtrage allergènes côté UI.
- `20260430_profile_password_changed_at.sql` — Ajouter `password_changed_at` (timestamp dernière modif du mot de passe).
- `20260430_profile_soft_delete.sql` — Implémenter soft-delete RGPD : `deleted_at` + `restore_token` 30 jours.
- `20260430_profile_username_unique.sql` — Index UNIQUE case-insensitive sur `profiles.username`.
- `20260503_extend_profiles_rgpd.sql` — Ajouter `language`, `last_login_at`, `consent_terms_accepted_at`, `consent_privacy_accepted_at` (preuves RGPD Art. 7).
- `20260503_community_terms.sql` — Ajouter `community_terms_accepted_at` (preuve d'acceptation de la charte communauté).
- `20261004_inscription_sans_impasse.sql` — `handle_new_user` ne tire plus le pseudo de l'adresse e-mail : pseudo saisi s'il est valide, sinon pseudo d'attente `chef_…` et `username_confirmed = false` (la création d'un compte Google échouait pour une adresse de moins de 3 ou de plus de 20 caractères). Preuve d'acceptation enfin datée : par le déclencheur (`consent_accepted` transmis à l'inscription par e-mail) ou par `record_signup_consent()` (parcours Google) ; le garde `guard_profiles_privileged_columns` laisse une date passer de vide à « maintenant », rien d'autre. `username_available(text)` répond sans exposer `profiles` ; `private.pseudo_reserve(text)` porte la liste des pseudos réservés. Appliquée le 2026-10-04 (`20261004213850`). Sonde rejouable : `supabase/probes/20261004_inscription_sans_impasse.sql`. 🔒🔑
- `20261005_regle_du_pseudo_tenue_par_la_base.sql` — Déclencheur `guard_profiles_username` : pour un non-admin, un pseudo qui change respecte la règle (3 à 20 lettres, chiffres, `_`, `-`) et n'est pas réservé. ⏳ **PAS ENCORE APPLIQUÉE** : voir « Une migration en attente » en tête de ce fichier. 🔒

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
- `20261004_recipes_moderation_guard.sql` — Déclencheur `guard_recipes_moderation_columns` : pour un non-admin, `moderation_status` ne vaut que `private`/`pending`, `status` est recalculé, les colonnes de promotion et d'auteur sont figées. Contraintes `recipes_unified_emoji_check` et `recipes_unified_image_url_check` (stockage public du projet). Appliquée le 2026-10-04 (`20261004191021`). Sonde rejouable : `supabase/probes/20261004_recipes_moderation_guard.sql`. 🔒

## Communauté (posts, replies, likes)

- `20260503_create_community.sql` — Créer `community_posts` + `community_replies` + `community_likes` avec RLS (public read si `deleted_at IS NULL`, owner write, anti-spam via fonctions). 🔒🔑🔗
- `20260503_community_reply_threading.sql` — Ajouter `parent_reply_id` (auto-référence) + `community_reply_likes` + triggers compteurs. 🔗
- `20260503_community_moderation.sql` — Ajouter `community_muted_until` + `deleted_by_admin` + 5 RPCs admin (soft-delete post, hard-delete post, soft-delete reply, set mute, etc.). 🔒🔑
- `20261004_sanctions_appliquees_par_la_base.sql` — Bannissement, sourdine, quotas (5 messages, 30 réponses par jour) et suppression en cours appliqués par la base : fonctions `private.compte_peut_ecrire()` / `private.compte_en_sourdine()` et 11 politiques RESTRICTIVES `sanctions_insert` / `sanctions_update` sur `community_posts`, `community_replies`, `engagement`, `support_tickets`, `support_messages`, `recipes_unified`, `shared_baskets`. Un compte sanctionné garde le droit de retirer ce qu'il a publié. Appliquée le 2026-10-04 (`20261004194413`). Sonde rejouable : `supabase/probes/20261004_sanctions_appliquees_par_la_base.sql`. 🔒🔑
- `20261005_profils_publics_et_compteurs.sql` — **Appliquée le 2026-10-05** (`profils_publics_et_compteurs`). Audit BDD-13 : la règle de lecture de `profiles` est « sa propre ligne, ou admin », et les posts, réponses et avis joignaient le profil de leur auteur — vide pour tout lecteur non admin. `get_public_profiles(uuid[])` (anon + authenticated, SECURITY DEFINER) ne rend que l'identifiant, le pseudo, l'avatar, la bannière, la bio et la date d'inscription, 200 identifiants au plus, comptes supprimés exclus ; `search_public_profiles(text)` (authenticated) sert « signaler un utilisateur » : 2 caractères, 8 résultats, ni admin, ni compte supprimé, ni soi-même, ni compte sans publication visible. Compteurs : `recompter_jaime()` sur `engagement` recompte `likes_count` des posts (réactions et anciens `post_like`) et des réponses (`reply_like`) ; `community_replies_count_fn()` recompte `replies_count` aux droits du propriétaire (il ne bougeait pas quand on répondait au post de quelqu'un d'autre) ; les deux verrouillent la ligne du compteur avant de compter. `community_set_updated_at_fn()` n'avance plus `updated_at` quand seul un compteur change. Trois fonctions orphelines retirées (`community_post_likes_count_fn`, `community_reply_likes_count_fn`, `recipe_reviews_set_updated_at_fn`). Rattrapage des compteurs (2 posts et 1 réponse étaient faux). Preuve : `supabase/probes/20261005_profils_publics_et_compteurs.sql` (essai à blanc puis après application : 0 écart sur 37 gestes). 🔒🔗

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
- `20261005_signalements_et_tickets_qui_aboutissent.sql` — **Appliquée le 2026-10-05** (`signalements_et_tickets_qui_aboutissent`). `chk_support_tickets_target_type` retrouve `recipe_review` ; `public.ouvrir_ticket(...)` crée le ticket ET son premier message d'un seul coup, **aux droits de l'appelant** (SECURITY INVOKER : plafond, sanctions et « son propre ticket » s'appliquent comme avant, aucun droit nouveau ; `account_restricted` pour un compte banni ou supprimé) ; déclencheur `trg_ticket_non_lu_admin` qui pose `has_unread_admin` à chaque message d'un utilisateur. Contexte : AUCUN signalement de la communauté ni d'un avis n'avait jamais abouti (colonne `body` inexistante, `title` oublié). Preuve : `supabase/probes/20261005_signalements_et_tickets.sql` (essai à blanc puis après application : 0 écart). 🔒
- `20261005_reponse_du_support_en_une_ecriture.sql` — **Appliquée le 2026-10-05** (`reponse_du_support_en_une_ecriture`). Audit ADM-02 : la réponse de l'admin était deux écritures du navigateur (le message, puis le ticket, résultat jeté) ; le déclencheur `trg_ticket_repondu` (SECURITY INVOKER, message de l'admin seulement) passe le ticket « non lu par l'utilisateur », « lu par l'admin », « en cours » dans la même transaction. Audit BDD-14 (première puce — étiqueté « hors audit » à tort jusqu'au 2026-10-05) : `support_messages_insert` exige désormais, pour un non-admin, `is_admin` faux et `sender_id = auth.uid()` — un compte pouvait écrire dans son ticket un message affiché comme une réponse du support (et recevoir la notification qui va avec). Compatible avec la v0.145 (ses écritures portent déjà ces valeurs). Preuve : `supabase/probes/20261005_reponse_du_support.sql` (avant 8 écarts ; essai à blanc puis après : 0 écart sur 13 gestes). 🔒
- `20261005_champs_d_autorite_gardes.sql` — **Appliquée le 2026-10-05** (`champs_d_autorite_gardes`). Audit BDD-14 (les autres puces). Trois déclencheurs dans `private`, qui ne visent que les écritures DIRECTES d'un compte ordinaire (`pg_trigger_depth() = 1`) : `garder_les_compteurs` — l'auteur ne réécrit plus `likes_count` / `replies_count` de son message ni `likes_count` de sa réponse (le recomptage du lot 3b, à la profondeur 2, passe) ; `garder_le_ticket` — un ticket naît ouvert, non lu par l'admin, lu par son auteur (valeurs imposées, comme `ouvrir_ticket` : la v0.145 crée ses tickets sans `has_unread_admin`), puis son auteur ne change que le titre et « lu » de son côté, et peut allumer le badge de l'admin mais plus l'éteindre ; `horodater_la_charte` — `community_terms_accepted_at` se pose à l'heure du serveur, ne se réécrit pas, se retire (NULL). `guard_profiles_privileged_columns` n'est pas modifiée. Compatible avec la v0.145 (relue). Preuve : `supabase/probes/20261005_champs_d_autorite.sql` (avant 14 écarts ; essai à blanc puis après : 0 écart sur 35 gestes). 🔒
- `20261005_signalements_comptes_a_part.sql` — **Appliquée le 2026-10-05** (`signalements_comptes_a_part`). Audit CPT-17 (le plafond partagé). `compte_tickets_ouverts()` ne compte plus que les demandes ; `compte_signalements_ouverts()` compte les signalements ; la règle `support_tickets_insert` choisit le plafond selon le type : 10 signalements, 3 demandes (l'admin n'est pas plafonné). Avant, trois signalements en attente empêchaient d'écrire au support, et trois questions de signaler un contenu. Plafond côté navigateur : `MAX_OPEN_REPORTS` (`plafond-tickets-coherence.test.js` relit les deux nombres). La v0.145 reste plus stricte que la base jusqu'à la release. Preuve : `supabase/probes/20261005_signalements_comptes_a_part.sql` (avant 6 écarts ; essai à blanc puis après : 0 écart sur 8 gestes). 🔒

## Audit & RGPD

- `20260501_activity_logs_append_only.sql` — RLS append-only : admin SELECT + INSERT, UPDATE et DELETE = `USING (false)` (Art. 30 RGPD : audit log inviolable). 🔒
- `20260502_activity_logs_metadata.sql` — Ajouter colonne `metadata jsonb` sur `activity_logs` pour metadata structurée auditable.
- `20260503_rpc_anonymize_user.sql` — RPC atomique `anonymize_user(uuid)` SECURITY DEFINER (admin OU self), réutilisable par pg_cron purge inactifs. 🔑
- `20260503_pg_cron_purges.sql` — 4 jobs cron RGPD : purge notifications lues 6m/non-lues 12m, tickets résolus 24m, soft-delete profiles 30j. 🔑
- `20261005_quotas_par_compte.sql` — **Appliquée le 2026-10-05** (`quotas_par_compte`). Audit BDD-08 (la partie e-mails). `public.email_log` (compte, sorte, heure ; RLS sans règle, droits retirés à `anon`/`authenticated`, effacée avec le compte) et `public.reserver_un_email(compte, sorte, plafond)` : sous un verrou propre au compte, compte les envois des 24 dernières heures et réserve le suivant sous le plafond (aux droits de l'appelant, exécutable par la seule clé service). Purge quotidienne à 7 jours (`purge_email_log`). Utilisée par `_shared/email-quota.ts` (changement de profil, suppression de compte) — **fonctions edge à déployer avec l'accord d'Antoine** ; d'ici là la table reste vide. Preuve : `supabase/probes/20261005_quotas_par_compte.sql` (avant 18 écarts ; essai à blanc puis après : 0 écart sur 18 gestes). 🔒
- `20261008095232_consultations_sensibles_tracees.sql` — **Appliquée le 2026-10-08** (`consultations_sensibles_tracees`, version 20261008095232). Audit ADM-05 (lot 12i). `admin_reveler_compte(p_user_id, p_motif)` rend l'e-mail, la dernière connexion et les allergènes d'UN compte, pour un administrateur, et écrit la ligne `sensitive_data_accessed` (cible `user`, motif et champs en métadonnées) AVANT de lire : si le journal refuse la ligne, rien n'est rendu. Motif de 1 à 400 caractères (22023), compte inexistant P0002, non-admin 42501 ; `anon` sans droit d'appel. Sonde : avant 13 écarts sur 13, essai à blanc puis après 13 sur 13. 🔑
- `20261008_retrait_admin_get_auth_users_apres_release.sql` — **🔴 À APPLIQUER JUSTE APRÈS LA RELEASE** (pas avant : la v0.145 appelle encore `admin_get_auth_users`). Retire son droit d'appel (REVOKE, réversible). Sonde : `supabase/probes/20261008_retrait_admin_get_auth_users_apres_release.sql` (essai à blanc 2 sur 2).
- `20261005_journal_et_textes_bornes.sql` — **Appliquée le 2026-10-05** (`journal_et_textes_bornes`). Audit ADM-07 et BDD-10. Journal : un compte ordinaire n'y écrit plus que les cinq lignes que l'application écrit pour lui (`private.entree_de_journal_permise`, une forme par action : cible et métadonnées permises) ; l'admin écrit toute action, mais sous son propre nom ; `trg_horodater_le_journal` pose l'heure du serveur (une ligne datée de 2099 restait en tête du journal et échappait à la purge) ; action en snake_case (64), cible 128, type 64, métadonnées 2 048 octets. Les fonctions serveur (suppression RGPD, anonymisation, notifications, promotion) appartiennent à `postgres` et écrivent comme avant. Tailles maximales : avis 2 000, réaction 16, message de support 5 000, titre de ticket 200, identifiant anonyme 64, panier partagé 64 Ko, recettes (nom 2 Ko, description 10 Ko, ingrédients et étapes 32 Ko, petits champs bornés). Notifications (BDD-10 les cite) : le destinataire ne peut plus modifier que `read_at` — un droit de colonne plutôt qu'une borne, qui ferme aussi la réécriture du lien et de l'expiration. Ajouts à la liste de BDD-10 : avatar et bannière (32, servis à tous par `get_public_profiles` depuis le lot 3b), recette liée à un message (100), cible d'un ticket (128), type de cible du journal (64). L'heure du journal relève d'ADM-28. Preuve : `supabase/probes/20261005_journal_et_textes_bornes.sql` (avant 30 écarts ; essai à blanc puis après application : 0 écart sur 49 gestes). 🔒

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
