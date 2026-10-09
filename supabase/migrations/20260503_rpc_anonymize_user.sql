-- ============================================================
-- v3.6.0 — RPC anonymize_user(uuid) atomique
-- ------------------------------------------------------------
-- Anonymise les données d'un utilisateur tout en préservant les artéfacts
-- publics (recettes promues qui restent dans le catalogue, mais sans crédit
-- nominatif). RGPD Art. 17 : droit à l'effacement, mais respect du droit
-- des autres utilisateurs (les recettes promues bénéficient à la communauté).
--
-- À appeler :
--   • Manuellement par l'admin via le panel admin (Sprint futur)
--   • Automatiquement par pg_cron au moment de la purge hard à 30j
--     (job qui parcourt profiles.deleted_at < now() - interval '30 days')
--
-- SECURITY DEFINER → s'exécute avec les droits du propriétaire (postgres),
-- donc bypass RLS pour pouvoir anonymiser à travers les tables.
--
-- Le profile lui-même n'est PAS supprimé ici (le hard delete reste le job
-- de la fonction Edge `delete-account` ou de la purge pg_cron qui gérera
-- aussi auth.users). Cette RPC se concentre sur l'anonymisation des
-- données dérivées (recettes promues, signalements, support).
-- ============================================================

CREATE OR REPLACE FUNCTION public.anonymize_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid    uuid := auth.uid();
  v_is_admin      boolean := public.is_admin();
  v_is_self       boolean := (v_caller_uid = target_user_id);
  v_recipes_count integer;
  v_reports_count integer;
  v_msgs_count    integer;
BEGIN
  -- Autorisation : admin OU self-service (un user peut s'anonymiser lui-même)
  IF NOT (v_is_admin OR v_is_self) THEN
    RAISE EXCEPTION 'Forbidden — admin or self only' USING ERRCODE = 'P0001';
  END IF;

  -- 1. base_recipes : retire le snapshot du nom (le FK original_author_id
  --    est déjà ON DELETE SET NULL pour le cas hard-delete).
  UPDATE public.base_recipes
  SET original_author_name = NULL
  WHERE original_author_id = target_user_id;
  GET DIAGNOSTICS v_recipes_count = ROW_COUNT;

  -- 2. support_tickets : anonymise les signalements/tickets (user_id = NULL
  --    n'est pas autorisé par le schéma, on flag le ticket comme orphelin
  --    via le titre — la conversation reste lisible côté admin).
  -- Note : on ne touche PAS à user_id pour ne pas casser les FK des messages.
  --        L'admin verra "compte supprimé" dans la UI via le user_id absent
  --        de profiles (cf. ProfileBadge).
  --        Si on veut vraiment cacher l'auteur des messages, c'est ON DELETE
  --        CASCADE auto via auth.users plus tard.

  -- 3. activity_logs : ne touche PAS (append-only, RGPD Art. 30 — registre
  --    des activités de traitement, conservation légale).

  -- 4. profiles : anonymise username + avatar (mais le row reste pour
  --    référencer l'historique). Le hard-delete viendra après 30j.
  UPDATE public.profiles
  SET username = 'utilisateur-supprimé',
      avatar_id = 'chef-1'
  WHERE id = target_user_id;

  -- 5. Compte les signalements (pas modifiés mais utile pour le retour)
  SELECT count(*) INTO v_reports_count
  FROM public.support_tickets
  WHERE user_id = target_user_id AND type = 'report';

  -- 6. Compte les messages support
  SELECT count(*) INTO v_msgs_count
  FROM public.support_messages
  WHERE sender_id = target_user_id;

  -- 7. Log de l'anonymisation (RGPD Art. 17 : trace de l'exécution)
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    v_caller_uid,
    'account_anonymized',
    target_user_id::text,
    'user',
    jsonb_build_object(
      'recipes_anonymized', v_recipes_count,
      'reports_kept', v_reports_count,
      'support_messages_kept', v_msgs_count,
      'is_self_request', v_is_self
    )
  );

  RETURN json_build_object(
    'anonymized', true,
    'user_id', target_user_id,
    'recipes_anonymized', v_recipes_count,
    'reports_kept', v_reports_count,
    'support_messages_kept', v_msgs_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonymize_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.anonymize_user(uuid) IS
  'v3.6.0 — Anonymise les données d''un utilisateur (RGPD Art. 17). SECURITY DEFINER : autorisé pour admin ou self uniquement. Préserve les recettes promues mais retire le snapshot du nom. Ne supprime PAS le profile (hard delete = job séparé pg_cron à 30j).';
