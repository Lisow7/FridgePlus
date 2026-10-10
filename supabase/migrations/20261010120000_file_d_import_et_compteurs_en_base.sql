-- Lot 12l de l'audit du 2026-10-04 — ADM-17 (1, 2, 3, +), ADM-28 (reste),
-- ADM-12 (1, 2), ADM-11, RGPD-11 (d1), ARCH-13 (5).
--
-- 1. La file d'import de recettes se publie et se rejette EN UNE TRANSACTION,
--    côté base. `admin_publier_import` insère la recette officielle, marque la
--    ligne de transit, écrit l'événement et le journal — ou rien. Avant, le
--    navigateur enchaînait trois écritures sans transaction (une recette
--    publiée dont la ligne de transit restait « valid » si la deuxième
--    échouait), fournissait lui-même l'acteur (`resolved_by`, `actor_id`),
--    n'écrivait rien au journal — et le code d'un script Node (src/scripts/)
--    entrait dans le paquet du navigateur pour le faire.
-- 2. `admin_rejeter_import` : motif obligatoire ; 0 ligne touchée = refus (un
--    rejet d'une ligne déjà résolue passait pour un succès).
-- 3. `admin_publier_lot_import` : toutes les lignes « valid » d'un lot, chacune
--    dans son propre sous-bloc (une erreur n'arrête pas les autres), bilan rendu.
-- 4. `admin_compteurs` : les neuf compteurs du panneau en UNE lecture, au lieu
--    de cinq comptages et de deux vues de santé téléchargées en entier à chaque
--    ouverture et après chaque enregistrement.
-- 5. `admin_activite_par_jour` : le graphique du tableau de bord agrégé en SQL
--    (trois tables lues en entier sur deux ans auparavant, bornées à 1 000
--    lignes chacune par PostgREST — des mois manquaient sans que rien le dise).
-- 6. `auth.users` AFTER DELETE : une ligne `account_deleted` au journal. La
--    politique de confidentialité promet une trace des suppressions de compte ;
--    l'effacement définitif (purge après 30 jours, comptes jamais confirmés)
--    n'en laissait aucune. Pas d'acteur, pas de donnée personnelle : l'identifiant seul.
-- 7. `feature_flags` BEFORE UPDATE : `updated_at` et `updated_by` posés par la
--    base, plus par le navigateur.
-- 8. `support_tickets` et `support_messages` AFTER DELETE : quand un ADMIN
--    supprime un ticket, un signalement ou un message, une ligne au journal
--    (ADM-14 (3) : aucune trace auparavant, ni pour le droit à l'effacement
--    d'un message de membre). Un membre qui supprime son propre ticket, et
--    l'effacement d'un compte (tâche sans utilisateur, tickets emportés par la
--    clé étrangère), n'en écrivent pas — `account_deleted` couvre le second.
--    Les messages emportés par la suppression de leur ticket ne font pas une
--    ligne chacun : le ticket a la sienne.
--
-- Additive. Retour arrière : DROP des cinq fonctions publiques, des quatre
-- déclencheurs et de leurs fonctions ; le client d'avant (v0.145) ne les
-- appelle pas. Les déclencheurs naissent par CREATE OR REPLACE TRIGGER : un
-- DROP de premier niveau fait échouer la confirmation d'apply_migration.
--
-- Sonde : supabase/probes/20261010_file_d_import_et_compteurs.sql (un seul bloc
-- DO annulé : rien n'est écrit).

-- ── 1. Publier une ligne de transit ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_publier_import(p_staging_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonction$
DECLARE
  v_ligne public.recipe_imports_staging%ROWTYPE;
  v_p     jsonb;
  v_id    text;
  v_n     integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ligne FROM public.recipe_imports_staging WHERE id = p_staging_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ligne de transit introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF v_ligne.status NOT IN ('pending', 'valid') THEN
    RAISE EXCEPTION 'ligne de transit non publiable (statut %)', v_ligne.status USING ERRCODE = '22023';
  END IF;

  v_p  := coalesce(v_ligne.parsed_data, '{}'::jsonb);
  v_id := nullif(btrim(v_p ->> 'id'), '');
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ligne de transit sans identifiant de recette' USING ERRCODE = '22023';
  END IF;

  -- Mêmes colonnes que le publisher du pipeline (recipes-publisher.mjs), les
  -- valeurs par défaut de la table pour ce qui manque.
  INSERT INTO public.recipes_unified
    (id, origin, status, image_url, name, title, description, emoji,
     time_min, prep_time_min, cook_time_min, difficulty, type, servings, country,
     diet, allergens, ingredients, steps, functional_tags)
  VALUES
    (v_id, 'official', 'published',
     nullif(v_p ->> 'image_url', ''),
     coalesce(v_p -> 'name', '{}'::jsonb),
     v_p ->> 'title',
     coalesce(v_p -> 'description', '{}'::jsonb),
     coalesce(nullif(v_p ->> 'emoji', ''), '🍳'),
     coalesce((v_p ->> 'time_min')::integer, 30),
     (v_p ->> 'prep_time_min')::integer,
     (v_p ->> 'cook_time_min')::integer,
     coalesce(nullif(v_p ->> 'difficulty', ''), 'medium'),
     coalesce(nullif(v_p ->> 'type', ''), 'main'),
     coalesce((v_p ->> 'servings')::integer, 2),
     v_p ->> 'country',
     coalesce(v_p -> 'diet', '[]'::jsonb),
     coalesce(ARRAY(SELECT jsonb_array_elements_text(v_p -> 'allergens')), '{}'::text[]),
     coalesce(v_p -> 'ingredients', '[]'::jsonb),
     coalesce(v_p -> 'steps', '[]'::jsonb),
     coalesce(ARRAY(SELECT jsonb_array_elements_text(v_p -> 'functional_tags')), '{}'::text[]));

  UPDATE public.recipe_imports_staging
     SET status = 'published',
         published_recipe_id = v_id,
         resolved_at = now(),
         resolved_by = auth.uid(),
         updated_at = now()
   WHERE id = p_staging_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ligne de transit non marquée' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.recipe_import_events (staging_id, event_type, actor_id, payload)
  VALUES (p_staging_id, 'published', auth.uid(), jsonb_build_object('recipeId', v_id));

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (auth.uid(), 'recipe_import_published', v_id, 'base_recipe',
          jsonb_build_object('staging_id', p_staging_id::text, 'source', v_ligne.source));

  RETURN v_id;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION public.admin_publier_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publier_import(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_publier_import(uuid) IS
  'Publie une ligne de la file d''import (recette officielle + ligne marquée + événement + journal) en une transaction. Admin seul. Lot 12l, 2026-10-10.';

-- ── 2. Rejeter une ligne de transit ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_rejeter_import(p_staging_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonction$
DECLARE
  v_motif text;
  v_n     integer;
  v_statut text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  v_motif := left(nullif(btrim(coalesce(p_motif, '')), ''), 500);
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'motif obligatoire' USING ERRCODE = '22023';
  END IF;

  UPDATE public.recipe_imports_staging
     SET status = 'rejected',
         admin_notes = v_motif,
         resolved_at = now(),
         resolved_by = auth.uid(),
         updated_at = now()
   WHERE id = p_staging_id
     AND status IN ('pending', 'valid', 'invalid', 'admin_review');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    SELECT status INTO v_statut FROM public.recipe_imports_staging WHERE id = p_staging_id;
    IF v_statut IS NULL THEN
      RAISE EXCEPTION 'ligne de transit introuvable' USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'ligne de transit déjà résolue (statut %)', v_statut USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.recipe_import_events (staging_id, event_type, actor_id, payload)
  VALUES (p_staging_id, 'rejected', auth.uid(), jsonb_build_object('reason', v_motif));

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (auth.uid(), 'recipe_import_rejected', p_staging_id::text, 'recipe_import',
          jsonb_build_object('reason', v_motif));
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION public.admin_rejeter_import(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rejeter_import(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_rejeter_import(uuid, text) IS
  'Rejette une ligne de la file d''import avec un motif obligatoire ; 0 ligne touchée = refus. Admin seul. Lot 12l, 2026-10-10.';

-- ── 3. Publier tout un lot ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_publier_lot_import(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonction$
DECLARE
  v_id      uuid;
  v_publies integer := 0;
  v_echecs  jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  FOR v_id IN
    SELECT id FROM public.recipe_imports_staging
     WHERE batch_id = p_batch_id AND status = 'valid'
     ORDER BY created_at, id
  LOOP
    BEGIN
      PERFORM public.admin_publier_import(v_id);
      v_publies := v_publies + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Une ligne qui résiste ne bloque pas les autres ; le bilan la nomme.
      v_echecs := v_echecs || jsonb_build_object('stagingId', v_id::text, 'error', left(SQLERRM, 200));
    END;
  END LOOP;
  RETURN jsonb_build_object('published', v_publies, 'failed', v_echecs);
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION public.admin_publier_lot_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publier_lot_import(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_publier_lot_import(uuid) IS
  'Publie toutes les lignes « valid » d''un lot d''import, une par une (chaque échec est nommé, les autres passent). Admin seul. Lot 12l, 2026-10-10.';

-- ── 4. Les compteurs du panneau, en une lecture ────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_compteurs()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fonction$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ingredients',        (SELECT count(*) FROM public.ingredients),
    'base_recipes',       (SELECT count(*) FROM public.base_recipes),
    'users',              (SELECT count(*) FROM public.profiles),
    'pending',            (SELECT count(*) FROM public.custom_recipes WHERE moderation_status = 'pending' AND deleted_at IS NULL),
    'tickets_open',       (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress')),
    'tickets_unread',     (SELECT count(*) FROM public.support_tickets WHERE has_unread_admin),
    'reports_open',       (SELECT count(*) FROM public.support_tickets WHERE type = 'report' AND status = 'open'),
    'health_recipes',     (SELECT count(*) FROM public.recipe_health_check WHERE cardinality(issues) > 0),
    'health_ingredients', (SELECT count(*) FROM public.ingredient_health_check WHERE cardinality(issues) > 0));
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION public.admin_compteurs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_compteurs() TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_compteurs() IS
  'Les neuf compteurs du panneau d''administration en une lecture (membres, catalogue, modération, support, signalements, santé des données). Admin seul. Lot 12l, 2026-10-10.';

-- ── 5. L'activité par jour, pour le graphique ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_activite_par_jour(p_depuis timestamptz)
RETURNS TABLE (jour date, actions bigint, inscriptions bigint, recettes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fonction$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  -- sum(bigint) rend un numeric : sans le transtypage, RETURN QUERY refuse le
  -- résultat (« returned type numeric does not match expected type bigint »).
  RETURN QUERY
  SELECT s.jour, sum(s.a)::bigint, sum(s.i)::bigint, sum(s.r)::bigint
    FROM (
      SELECT (l.created_at AT TIME ZONE 'UTC')::date AS jour, 1::bigint AS a, 0::bigint AS i, 0::bigint AS r
        FROM public.activity_logs l WHERE l.created_at >= p_depuis
      UNION ALL
      SELECT (p.created_at AT TIME ZONE 'UTC')::date, 0::bigint, 1::bigint, 0::bigint
        FROM public.profiles p WHERE p.created_at >= p_depuis
      UNION ALL
      SELECT (c.created_at AT TIME ZONE 'UTC')::date, 0::bigint, 0::bigint, 1::bigint
        FROM public.custom_recipes c WHERE c.created_at >= p_depuis AND c.deleted_at IS NULL
    ) s
   GROUP BY s.jour
   ORDER BY s.jour;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION public.admin_activite_par_jour(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activite_par_jour(timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_activite_par_jour(timestamptz) IS
  'Actions du journal, inscriptions et recettes communautaires créées, par jour (UTC) depuis une date. Admin seul. Lot 12l, 2026-10-10.';

-- ── 6. L'effacement définitif d'un compte laisse une trace ─────────────────────

CREATE OR REPLACE FUNCTION private.tracer_l_effacement_definitif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  -- Pas d'acteur (la purge est une tâche, pas une personne), pas de donnée
  -- personnelle : l'identifiant du compte effacé, et l'heure (déclencheur
  -- `trg_horodater_le_journal`). Les traces où ce compte était l'acteur gardent
  -- leur ligne, `user_id` mis à NULL par la clé étrangère.
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (NULL, 'account_deleted', OLD.id::text, 'user', NULL);
  RETURN OLD;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION private.tracer_l_effacement_definitif() FROM PUBLIC;

CREATE OR REPLACE TRIGGER tracer_l_effacement_definitif
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.tracer_l_effacement_definitif();

-- ── 7. L'horodatage d'une bascule vient de la base ─────────────────────────────

CREATE OR REPLACE FUNCTION private.horodater_la_bascule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION private.horodater_la_bascule() FROM PUBLIC;

CREATE OR REPLACE TRIGGER trg_horodater_la_bascule
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION private.horodater_la_bascule();

-- ── 8. Les suppressions du support laissent une trace ──────────────────────────

CREATE OR REPLACE FUNCTION private.tracer_la_suppression_d_un_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  -- Seulement le geste d'un admin : ni le membre qui retire son propre ticket,
  -- ni la purge d'un compte (sans utilisateur, `is_admin()` est faux).
  IF NOT public.is_admin() THEN
    RETURN OLD;
  END IF;
  IF OLD.type = 'report' THEN
    INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
    VALUES ((SELECT auth.uid()), 'report_deleted', OLD.id::text, 'ticket', jsonb_build_object('type', OLD.type));
  ELSE
    INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
    VALUES ((SELECT auth.uid()), 'ticket_deleted', OLD.id::text, 'ticket', jsonb_build_object('type', OLD.type));
  END IF;
  RETURN OLD;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION private.tracer_la_suppression_d_un_ticket() FROM PUBLIC;

CREATE OR REPLACE TRIGGER tracer_la_suppression_d_un_ticket
  AFTER DELETE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.tracer_la_suppression_d_un_ticket();

CREATE OR REPLACE FUNCTION private.tracer_la_suppression_d_un_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  -- Seulement le geste d'un admin (voir le déclencheur des tickets). Emporté
  -- par la suppression de son ticket (clé étrangère ON DELETE CASCADE, le
  -- ticket n'existe déjà plus) : le ticket a sa ligne, pas chaque message.
  IF NOT public.is_admin()
     OR NOT EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = OLD.ticket_id) THEN
    RETURN OLD;
  END IF;
  -- `from_admin` faux = le message d'un membre retiré (droit à l'effacement).
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES ((SELECT auth.uid()), 'support_message_deleted', OLD.id::text, 'support_message',
          jsonb_build_object('ticket_id', OLD.ticket_id::text, 'from_admin', OLD.is_admin));
  RETURN OLD;
END;
$fonction$;

REVOKE EXECUTE ON FUNCTION private.tracer_la_suppression_d_un_message() FROM PUBLIC;

CREATE OR REPLACE TRIGGER tracer_la_suppression_d_un_message
  AFTER DELETE ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION private.tracer_la_suppression_d_un_message();
