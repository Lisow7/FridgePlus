-- 2026-10-08 — L'anonymisation des comptes supprimés tient, au deuxième compte
-- comme au premier, et efface vraiment ce qui désigne la personne.
-- Audit du 2026-10-04, BDD-06 (lot 4) ; complément d'audit du 2026-10-06
-- (contrôle de l'appelant qui laissait passer en l'absence d'appelant).
--
-- ═════════════════════════════════════════════════
-- CE QUI N'ALLAIT PAS
--
-- - `anonymize_user` donnait à chaque compte le MÊME pseudo,
--   « utilisateur-supprimé ». Les pseudos sont uniques (`lower(username)`) :
--   le deuxième compte anonymisé levait 23505, et dans la tâche nocturne
--   `anonymize_soft_deleted_profiles` (un `DO … LOOP` sans `EXCEPTION`) une
--   seule erreur annulait tout — plus aucun profil n'était anonymisé, chaque
--   nuit. Au 2026-10-08 : 0 profil en attente, donc latent.
-- - Elle laissait la bio publique, le pays, les allergènes (donnée de santé)
--   et leur accord, les budgets et la bannière.
-- - Son contrôle `NOT (is_admin() OR auth.uid() = cible)` valait NULL sans
--   appelant (`auth.uid()` vide) et LAISSAIT PASSER. Non exploitable par l'API
--   (`anon` n'a pas EXECUTE, un appelant connecté a toujours un uid), mais la
--   tâche nocturne reposait justement sur ce passe-droit.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. `private.anonymiser_le_compte(cible, demandeur)` porte l'anonymisation :
--    un pseudo UNIQUE par compte (`suppr-` + 14 caractères de l'identifiant :
--    20 caractères, la longueur maximale, et conforme à la règle du pseudo),
--    avatar par défaut, bio, pays, allergènes et leur accord, budgets et
--    bannière vidés ; crédit d'auteur retiré des recettes promues ;
--    abonnements push effacés ; une ligne au journal (`account_anonymized`).
--    Voie (b) du constat : elle ne demande aucun `DROP INDEX`. L'index
--    d'unicité en double (`profiles_username_lower_idx` /
--    `profiles_username_unique_lower`) reste à retirer, avec l'accord d'Antoine.
-- 2. `public.anonymize_user` garde sa signature et FERME son contrôle
--    (`IS NOT TRUE`) : sans appelant, refus.
-- 3. `private.anonymiser_les_comptes_supprimes()` parcourt les profils
--    supprimés depuis plus de 30 jours et pas encore anonymisés ; chaque
--    compte est traité à part (un échec ne bloque plus les autres, il laisse
--    un avertissement). La tâche `anonymize_soft_deleted_profiles` (3 h 30 UTC)
--    l'appelle au lieu de son ancien bloc `DO`.
--
-- Retour arrière : remettre `anonymize_user` de 20260503_rpc_anonymize_user.sql
-- et l'ancien bloc `DO` de la tâche (même nom), puis supprimer les deux
-- fonctions privées.
--
-- Sonde : supabase/probes/20261008_anonymisation_qui_tient.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION private.anonymiser_le_compte(p_cible uuid, p_demandeur uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
DECLARE
  v_recettes integer;
  v_signalements integer;
  v_messages integer;
BEGIN
  UPDATE public.base_recipes
     SET original_author_name = NULL
   WHERE original_author_id = p_cible;
  GET DIAGNOSTICS v_recettes = ROW_COUNT;

  UPDATE public.profiles
     SET username            = 'suppr-' || left(replace(p_cible::text, '-', ''), 14),
         avatar_id           = 'chef-1',
         community_bio       = NULL,
         country_code        = NULL,
         allergen_prefs      = '{}',
         allergen_consent_at = NULL,
         monthly_budget      = NULL,
         per_trip_budget     = NULL,
         banner_id           = NULL
   WHERE id = p_cible;

  DELETE FROM public.push_subscriptions WHERE user_id = p_cible;

  SELECT count(*) INTO v_signalements FROM public.support_tickets WHERE user_id = p_cible AND type = 'report';
  SELECT count(*) INTO v_messages FROM public.support_messages WHERE sender_id = p_cible;

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    p_demandeur,
    'account_anonymized',
    p_cible::text,
    'user',
    jsonb_build_object(
      'recipes_anonymized', v_recettes,
      'reports_kept', v_signalements,
      'support_messages_kept', v_messages,
      'is_self_request', p_demandeur IS NOT DISTINCT FROM p_cible,
      'scheduled', p_demandeur IS NULL
    )
  );

  RETURN json_build_object(
    'anonymized', true,
    'user_id', p_cible,
    'recipes_anonymized', v_recettes,
    'reports_kept', v_signalements,
    'support_messages_kept', v_messages
  );
END;
$fonction$;

REVOKE ALL ON FUNCTION private.anonymiser_le_compte(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.anonymize_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  -- Fermé : sans appelant, l'ancienne expression valait NULL et laissait passer.
  IF (public.is_admin() OR (SELECT auth.uid()) = target_user_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden — admin or self only' USING ERRCODE = 'P0001';
  END IF;
  RETURN private.anonymiser_le_compte(target_user_id, (SELECT auth.uid()));
END;
$fonction$;

CREATE OR REPLACE FUNCTION private.anonymiser_les_comptes_supprimes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
DECLARE
  v_profil record;
  v_faits integer := 0;
BEGIN
  FOR v_profil IN
    SELECT id
      FROM public.profiles
     WHERE deleted_at IS NOT NULL
       AND deleted_at < now() - interval '30 days'
       AND username !~ '^suppr-[0-9a-f]{14}$'
       AND username <> 'utilisateur-supprimé'
  LOOP
    BEGIN
      PERFORM private.anonymiser_le_compte(v_profil.id, NULL);
      v_faits := v_faits + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Un compte qui résiste ne bloque plus les autres ; l'avertissement dit lequel.
      RAISE WARNING 'anonymisation impossible pour % : % (%)', v_profil.id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
  RETURN v_faits;
END;
$fonction$;

REVOKE ALL ON FUNCTION private.anonymiser_les_comptes_supprimes() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('anonymize_soft_deleted_profiles', '30 3 * * *', $tache$SELECT private.anonymiser_les_comptes_supprimes()$tache$);

COMMIT;
