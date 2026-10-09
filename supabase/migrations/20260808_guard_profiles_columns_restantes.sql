-- ✅ APPLIQUÉE le 2026-08-13, sous le nom `guard_profiles_consentements` :
-- son corps est celui de la fonction en base. Le SQL exact inscrit au registre
-- est dans 20260813111101_guard_profiles_consentements.sql (reconstitué le
-- 2026-10-08, audit BDD-19). Ne pas la rejouer. Ce fichier garde l'historique
-- ci-dessous, qui reste vrai pour la période du 8 au 13 août.
--
-- (Jusqu'au 2026-08-13) MIGRATION ÉCRITE MAIS NON APPLIQUÉE. Écrite le 2026-08-08,
-- **CORRIGÉE le 2026-08-12 après avoir été prouvée FAUSSE** (voir ci-dessous).
--
-- Motif du report : il n'existe qu'un seul projet Supabase (la production, pas
-- de staging). Un DDL sur un trigger BEFORE UPDATE de `profiles` peut bloquer
-- des écritures légitimes de l'application. Elle est livrée prête à appliquer,
-- la décision revenant à qui peut surveiller la prod juste après.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 🔴 CE QUE LA VERSION DU 8 AOÛT FAISAIT DE FAUX — et qui aurait coûté cher
--
-- Elle protégeait AUSSI `deleted_at` et `restore_token` en UPDATE, en affirmant
-- qu'ils n'étaient « JAMAIS écrits par le client », avec même un avertissement
-- à ne pas les confondre avec les autres tables.
--
-- **C'est faux.** `src/shared/contexts/auth-provider.jsx:127-140` — auto-restore
-- d'un compte soft-deleted : quand l'utilisateur revient se connecter dans la
-- fenêtre de 30 jours, c'est LE CLIENT qui annule la suppression :
--
--     if (p?.deleted_at) {
--       await supabase.from('profiles')
--         .update({ deleted_at: null, restore_token: null })
--         .eq('id', currentUser.id)
--     }
--
-- Écriture sur `profiles`, sur SA PROPRE ligne, donc `auth.uid() = NEW.id` : le
-- garde ne sort pas, il lève l'exception.
--
-- PROUVÉ le 2026-08-12 sur la base de production, dans un bloc DO terminé par
-- RAISE EXCEPTION (donc intégralement annulé — vérifié après coup : garde
-- d'origine restauré, 0 compte soft-deleted, 0 jeton) :
--
--     AUTO-RESTORE   = BLOQUÉ (42501)   <<< casse la restauration
--     last_login_at  = PASSE  (ok)
--     escalade role  = BLOQUÉE (ok)
--
-- 🔴 Et l'échec aurait été SILENCIEUX : `auth-provider.jsx:137` ne journalise
-- l'erreur que sous `import.meta.env.DEV`. En production, l'utilisateur se
-- croirait revenu alors que son compte resterait programmé pour purge puis
-- anonymisation. Perte de données, sur un parcours RGPD.
--
-- ⇒ `deleted_at` et `restore_token` sont RETIRÉS de la branche UPDATE. Les
--   protéger suppose de déplacer d'abord l'auto-restore côté serveur (edge
--   function `restore-account`), ce qui est un chantier à part.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- CE QUI RESTE, ET POURQUOI C'EST SÛR
--
-- Seules `consent_terms_accepted_at` et `consent_privacy_accepted_at` sont
-- ajoutées. Leur valeur PROBATOIRE suppose que l'utilisateur ne puisse pas les
-- réécrire lui-même.
--
-- Vérifié le 2026-08-12 : le client ne les écrit nulle part. Les deux seules
-- occurrences dans `src/` sont des listes de colonnes dans un `.select(...)`
-- (`data-export.js:49-50`, `auth-provider.jsx:44`). Et les 14 appels à
-- `updateProfile({...})` ne portent que 10 champs, tous en clés littérales,
-- aucun objet calculé ni spread : `allergen_prefs`, `avatar_id`, `banner_id`,
-- `country_code`, `monthly_budget`, `per_trip_budget`, `profiling_opted_out`,
-- `unlocked_banners`, `username`, `username_confirmed`.
--
-- 🛡️ Garde-fou : `src/test/unit/guard-profiles-vs-ecritures-client.test.js`
-- fait échouer la CI si une colonne protégée ici redevient écrite par le client.
-- C'est LUI qui aurait attrapé l'erreur du 8 août.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA BRANCHE INSERT GARDE `restore_token` ET `deleted_at` — ce n'est pas une
-- incohérence
--
-- L'auto-restore est un UPDATE. Un INSERT avec `deleted_at` ou `restore_token`
-- déjà positionnés serait, lui, illégitime. Et il est inatteignable depuis le
-- client : vérifié le 2026-08-12, `src/` ne contient AUCUN
-- `.from('profiles').insert(...)` — la ligne de profil naît côté serveur, sans
-- `auth.uid()`, donc le garde sort avant toute vérification.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POURQUOI LES EDGE FUNCTIONS NE SERONT PAS BLOQUÉES
--
-- Le garde sort immédiatement quand `auth.uid()` diffère de `NEW.id` :
--
--     IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
--       RETURN NEW;
--     END IF;
--
-- Une edge function en `service_role` n'a pas d'`auth.uid()`. Elle passe donc
-- sans condition — vérifié sur la définition réelle en base.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- AVANT D'APPLIQUER
--
--   1. Se connecter / se déconnecter (`last_login_at`, non protégé).
--   2. Vérifier qu'aucune écriture de `consent_*_at` n'a été ajoutée côté
--      client depuis : `npx vitest run src/test/unit/guard-profiles-vs-ecritures-client.test.js`
--   3. ⚠️ NE PLUS avoir besoin de tester la suppression/restauration de compte :
--      ce chemin n'est plus touché par cette migration.
--
-- Impact attendu à l'échelle actuelle : nul. Mesure
-- de durcissement à poser AVANT l'ouverture publique, pas un correctif urgent.
--
-- ROLLBACK : réappliquer la définition précédente de la fonction, qui est
-- identique à celle-ci moins les deux lignes `consent_*_accepted_at` de la
-- branche UPDATE.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin, ou écriture serveur (service_role : pas d'auth.uid()) → laisser passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role                  IS DISTINCT FROM 'user'
       OR COALESCE(NEW.banned, false)              IS DISTINCT FROM false
       OR NEW.special_role        IS NOT NULL
       OR COALESCE(NEW.subscription_status, 'free') IS DISTINCT FROM 'free'
       OR NEW.subscription_plan   IS NOT NULL
       OR NEW.subscription_ends_at IS NOT NULL
       OR NEW.trial_ends_at       IS NOT NULL
       OR NEW.stripe_customer_id  IS NOT NULL
       OR NEW.community_muted_until IS NOT NULL
       OR NEW.inactive_warned_at  IS NOT NULL
       -- Cycle de vie du compte : illégitime dès la création, et inatteignable
       -- depuis le client (aucun `.from('profiles').insert` dans `src/`).
       OR NEW.restore_token       IS NOT NULL
       OR NEW.deleted_at          IS NOT NULL
    THEN
      RAISE EXCEPTION 'forbidden: cannot set privileged profile columns'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- ⚠️ `restore_token` et `deleted_at` sont ABSENTS de cette branche, et ce
  -- n'est PAS un oubli : l'auto-restore côté client les écrit légitimement.
  -- Voir l'explication détaillée en tête de fichier avant de les rajouter.
  IF NEW.role                  IS DISTINCT FROM OLD.role
     OR NEW.banned             IS DISTINCT FROM OLD.banned
     OR NEW.special_role       IS DISTINCT FROM OLD.special_role
     OR NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_plan     IS DISTINCT FROM OLD.subscription_plan
     OR NEW.subscription_ends_at  IS DISTINCT FROM OLD.subscription_ends_at
     OR NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.community_muted_until IS DISTINCT FROM OLD.community_muted_until
     OR NEW.inactive_warned_at    IS DISTINCT FROM OLD.inactive_warned_at
     -- Ajout 2026-08-12 : preuves de consentement RGPD. Leur valeur probatoire
     -- suppose que l'utilisateur ne puisse pas les réécrire lui-même.
     OR NEW.consent_terms_accepted_at   IS DISTINCT FROM OLD.consent_terms_accepted_at
     OR NEW.consent_privacy_accepted_at IS DISTINCT FROM OLD.consent_privacy_accepted_at
  THEN
    RAISE EXCEPTION 'forbidden: cannot modify privileged profile columns'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;
