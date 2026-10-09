-- 2026-10-08 — Les comptes jamais confirmés s'effacent au bout de 30 jours.
-- Décision du 2026-10-07, choix d'Antoine : « non_confirmes = 30_jours ».
-- Audit du 2026-10-04 : un compte dont l'adresse n'a jamais été vérifiée
-- gardait son pseudo pour toujours, sans durée de conservation.
--
-- Sa question d'abord (« l'utilisateur pourrait revenir et tout perdre ? ») :
-- la confirmation par e-mail est exigée, donc un compte non confirmé n'a
-- jamais pu se connecter ni rien enregistrer. S'il revient après
-- l'effacement, il se réinscrit avec la même adresse et reprend son pseudo
-- s'il est encore libre. Au 2026-10-07 : 0 compte concerné sur 8.
--
-- ═════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. `private.effacer_les_comptes_jamais_confirmes()` efface un compte qui
--    remplit TOUTES ces conditions :
--      - adresse jamais confirmée (`email_confirmed_at` vide) ;
--      - jamais connecté (`last_sign_in_at` vide) ;
--      - créé il y a plus de 30 jours ;
--      - aucune donnée à lui : ni frigo, favoris, restes, listes, panier,
--        journal de cuisine, demande au support, panier partagé, abonnement
--        push, dépense, mouvement du stock, publication ni réponse dans la
--        communauté.
--    L'effacement passe par `auth.users` : le profil et ce qui en dépend
--    suivent en cascade, les traces techniques (journal, usage) perdent leur
--    lien (SET NULL). Si une contrainte s'y oppose quand même, ce compte-là
--    est laissé, les autres continuent. La fonction rend le nombre de comptes
--    effacés.
-- 2. Tâche `effacer_comptes_jamais_confirmes` (chaque jour, 4 h 30 UTC).
--
-- Ce qui ne change pas : un compte confirmé, ou qui s'est connecté une seule
-- fois, ou qui a la moindre donnée, n'est jamais touché par cette tâche.
--
-- Retour arrière : `SELECT cron.unschedule('effacer_comptes_jamais_confirmes');`
-- puis `DROP FUNCTION private.effacer_les_comptes_jamais_confirmes();`.
--
-- Sonde : supabase/probes/20261008_comptes_jamais_confirmes.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION private.effacer_les_comptes_jamais_confirmes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
DECLARE
  v_compte record;
  v_effaces integer := 0;
BEGIN
  FOR v_compte IN
    SELECT u.id
      FROM auth.users u
     WHERE u.email_confirmed_at IS NULL
       AND u.last_sign_in_at IS NULL
       AND u.created_at < now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM public.user_stock x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.user_favorites x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.user_leftovers x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.shopping_lists x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.basket_items x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.cooking_logs x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.support_tickets x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_baskets x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.spending_events x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.stock_events x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.community_posts x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.community_replies x WHERE x.user_id = u.id)
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_compte.id;
      v_effaces := v_effaces + 1;
    EXCEPTION WHEN foreign_key_violation THEN
      -- Une contrainte s'y oppose : ce compte reste, les autres continuent.
      NULL;
    END;
  END LOOP;
  RETURN v_effaces;
END;
$fonction$;

REVOKE ALL ON FUNCTION private.effacer_les_comptes_jamais_confirmes() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('effacer_comptes_jamais_confirmes', '30 4 * * *', $tache$SELECT private.effacer_les_comptes_jamais_confirmes()$tache$);

COMMIT;
