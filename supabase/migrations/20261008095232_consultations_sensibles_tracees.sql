-- 2026-10-08 — Consulter les données sensibles d'un compte laisse une trace
-- que le panneau admin ne peut pas contourner.
-- Audit du 2026-10-04, ADM-05 (points 1, 3 et 4).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS
--
-- 1. À chaque ouverture de l'onglet Utilisateurs, `admin_get_auth_users()`
--    rapatriait TOUS les e-mails et toutes les dernières connexions dans le
--    navigateur, sans journal. Le rideau « Masqué / Afficher avec motif »
--    n'était qu'un rideau d'interface : les e-mails étaient lisibles dans
--    l'onglet Réseau, et la ligne de journal était écrite PAR LE NAVIGATEUR,
--    séparément de la lecture.
-- 2. La dernière connexion s'affichait en clair hors du rideau, alors que le
--    journal des consultations la classe sensible.
-- 3. Les allergènes d'un compte (donnée potentiellement de santé) étaient lus
--    à l'ouverture de sa fiche, sans journal.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- `public.admin_reveler_compte(p_user_id, p_motif)` rend l'e-mail, la
-- dernière connexion et les allergènes d'UN compte, à la demande, et écrit la
-- ligne de journal DANS LA MÊME FONCTION, AVANT la lecture : si l'écriture
-- échoue, rien n'est rendu.
--   - réservée aux administrateurs (42501 sinon, aucune ligne écrite) ;
--   - motif obligatoire : 1 à 400 caractères après `btrim` (22023 sinon). Le
--     motif est celui que met en forme l'écran (`formatReason`) : un libellé
--     de 40 caractères au plus, « — », puis des détails bornés à 300 ;
--   - compte inexistant : P0002, aucune ligne écrite ;
--   - journal : action `sensitive_data_accessed`, cible `user` = le compte
--     consulté, métadonnées `reason` (le motif) et `champs` (ce qui est
--     rendu). L'heure est celle du serveur (`private.horodater_le_journal`).
--     Métadonnées : 400 caractères de motif tiennent dans les 2 048 octets
--     permis par `journal_et_textes_bornes`.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE FAIT PAS
--
-- - Elle ne retire PAS `admin_get_auth_users()` : la version en production
--   l'appelle encore à l'ouverture de l'onglet. Son retrait est la migration
--   `..._retrait_admin_get_auth_users_apres_release.sql`, à appliquer juste
--   après la release. Tant que la fonction existe, la promesse « toute
--   consultation est tracée » n'est pas tenue pour les e-mails.
-- - Un administrateur garde l'accès direct à `profiles.allergen_prefs` par
--   l'API (la RLS le lui permet) : la trace couvre le chemin du panneau, pas
--   une requête écrite à la main.
--
-- COMPATIBILITÉ : purement additive. Aucune ligne `sensitive_data_accessed`
-- n'existe en base au 2026-10-08 (mesuré) : aucun ancien format à reprendre.
--
-- PREUVE : `supabase/probes/20261008_consultations_sensibles_tracees.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_reveler_compte(p_user_id uuid, p_motif text)
RETURNS TABLE(email text, derniere_connexion timestamptz, allergenes text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_motif text := btrim(coalesce(p_motif, ''));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_motif) = 0 OR char_length(v_motif) > 400 THEN
    RAISE EXCEPTION 'Un motif est requis (400 caractères au plus)' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Compte introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- La trace D'ABORD : si elle ne s'écrit pas, la fonction lève et ne rend rien.
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    auth.uid(), 'sensitive_data_accessed', p_user_id::text, 'user',
    jsonb_build_object(
      'reason', v_motif,
      'champs', jsonb_build_array('email', 'last_sign_in_at', 'allergen_prefs')
    )
  );

  RETURN QUERY
    SELECT u.email::text, u.last_sign_in_at, coalesce(p.allergen_prefs, '{}'::text[])
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_user_id;
END;
$function$;

-- Supabase accorde EXECUTE à `anon` sur toute nouvelle fonction de `public` :
-- le retirer explicitement.
REVOKE ALL ON FUNCTION public.admin_reveler_compte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reveler_compte(uuid, text) TO authenticated;

COMMIT;
