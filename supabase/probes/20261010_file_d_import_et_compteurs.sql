-- Sonde de la migration 20261010120000_file_d_import_et_compteurs_en_base.sql :
-- la file d'import se publie et se rejette en une transaction côté base, le
-- lot rend son bilan, les compteurs et l'activité du panneau se lisent en une
-- fonction, l'horodatage d'une bascule vient de la base, les suppressions du
-- support faites par un admin et l'effacement d'un compte laissent une trace.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit — l'essai à blanc du DDL, les
-- lignes de transit, la recette, les tickets, le compte jetable sont annulés
-- avec le reste. Le « message d'erreur » est le rapport ; une ligne « ⚠ » est
-- un écart. Elle prend le compte admin et un compte ordinaire au hasard, par
-- leur seul identifiant ; aucune donnée personnelle n'est affichée.
--
-- L'essai à blanc est le FICHIER de la migration, recopié tel quel par
-- scripts (md5 d1a9d0c9c5faffaf4e2a59b25c8b4046) : une sonde composée à la main n'est pas la migration.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  u_admin uuid;
  u_autre uuid;
  n int;
  n2 int;
  v text;
  b boolean;
  b2 boolean;
  lot uuid := gen_random_uuid();
  id1 uuid; id2 uuid; id3 uuid; id4 uuid; id5 uuid; id6 uuid;
  t1 uuid; t2 uuid; t3 uuid; m1 uuid; m2 uuid;
  suffixe text := substr(md5(random()::text), 1, 8);
  compteurs jsonb;
  bilan jsonb;
  u_jetable uuid := gen_random_uuid();
BEGIN
  -- ── A. Avant ───────────────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname IN ('admin_publier_import', 'admin_rejeter_import', 'admin_publier_lot_import', 'admin_compteurs', 'admin_activite_par_jour');
  r := r || E'\nA1 fonctions du lot avant — attendu 0 : ' || n || CASE WHEN n = 0 THEN '' ELSE ' (déjà appliquée)' END;
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname IN ('tracer_l_effacement_definitif', 'trg_horodater_la_bascule', 'tracer_la_suppression_d_un_ticket', 'tracer_la_suppression_d_un_message');
  r := r || E'\nA2 déclencheurs du lot avant — attendu 0 : ' || n;
  SELECT count(*) INTO n FROM public.recipe_imports_staging WHERE status IN ('pending', 'valid');
  r := r || E'\nA3 lignes de transit publiables aujourd''hui (information) : ' || n;

  -- ── ESSAI À BLANC : le fichier de la migration, recopié tel quel ────────────
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
  -- ── fin du fichier de la migration ──────────────────────────────────────────

  -- ── B. L'admin publie, rejette, lit, supprime ──────────────────────────────
  SELECT id INTO u_admin FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT p.id INTO u_autre FROM public.profiles p JOIN auth.users au ON au.id = p.id
   WHERE p.role IS DISTINCT FROM 'admin' ORDER BY random() LIMIT 1;
  r := r || E'\nB0 un compte admin et un compte ordinaire trouvés — attendu oui/oui : '
       || CASE WHEN u_admin IS NULL THEN 'NON ⚠' ELSE 'oui' END || '/' || CASE WHEN u_autre IS NULL THEN 'NON ⚠' ELSE 'oui' END;

  -- Préparation sous le rôle de la sonde (les droits de table ne sont pas le
  -- sujet) ; les claims de l'admin sont posés pour que les déclencheurs le
  -- reconnaissent.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  VALUES (lot, 'admin_ui', 'sonde-' || suffixe || '-1', '{}'::jsonb, jsonb_build_object('id', 'sonde-' || suffixe || '-1', 'name', jsonb_build_object('fr', 'Sonde un', 'en', 'Probe one'), 'description', jsonb_build_object('fr', 'x'), 'emoji', '🧪', 'time_min', 10, 'difficulty', 'easy', 'type', 'main', 'servings', 2, 'country', 'fr', 'diet', '[]'::jsonb, 'allergens', jsonb_build_array('gluten'), 'ingredients', '[]'::jsonb, 'steps', jsonb_build_object('fr', jsonb_build_array('x')), 'functional_tags', '[]'::jsonb), 'valid')
  RETURNING id INTO id1;
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  VALUES (lot, 'admin_ui', 'sonde-' || suffixe || '-2', '{}'::jsonb, jsonb_build_object('id', 'sonde-' || suffixe || '-2', 'name', jsonb_build_object('fr', 'Sonde deux')), 'valid')
  RETURNING id INTO id2;
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  VALUES (lot, 'admin_ui', 'sonde-' || suffixe || '-3', '{}'::jsonb, jsonb_build_object('id', 'sonde-' || suffixe || '-3', 'name', jsonb_build_object('fr', 'Sonde trois')), 'valid')
  RETURNING id INTO id3;
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  VALUES (lot, 'admin_ui', 'sonde-' || suffixe || '-4', '{}'::jsonb, jsonb_build_object('name', jsonb_build_object('fr', 'Sans identifiant')), 'valid')
  RETURNING id INTO id4;
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  VALUES (gen_random_uuid(), 'admin_ui', 'sonde-' || suffixe || '-5', '{}'::jsonb, jsonb_build_object('id', 'sonde-' || suffixe || '-5'), 'pending')
  RETURNING id INTO id5;
  -- Une VRAIE ligne du pipeline, copiée (identifiant et clé suffixés) : la seule
  -- preuve que la fonction accepte les données que le pipeline produit.
  INSERT INTO public.recipe_imports_staging (batch_id, source, external_key, raw_payload, parsed_data, status)
  SELECT gen_random_uuid(), s.source, coalesce(s.external_key, s.id::text) || '-sonde-' || suffixe, '{}'::jsonb,
         s.parsed_data || jsonb_build_object('id', (s.parsed_data ->> 'id') || '-sonde-' || suffixe), 'valid'
    FROM public.recipe_imports_staging s WHERE s.status = 'published' ORDER BY random() LIMIT 1
  RETURNING id INTO id6;
  -- Le support : un ticket et deux messages d'un membre, un signalement, et un
  -- ticket que le membre supprimera lui-même.
  INSERT INTO public.support_tickets (user_id, type, title, status) VALUES (u_autre, 'question', 'Sonde ' || suffixe, 'open') RETURNING id INTO t1;
  INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (t1, u_autre, false, 'un') RETURNING id INTO m1;
  INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (t1, u_autre, false, 'deux') RETURNING id INTO m2;
  INSERT INTO public.support_tickets (user_id, type, title, status, target_type, target_id, reason_key) VALUES (u_autre, 'report', 'Sonde signalement ' || suffixe, 'open', 'community_post', 'sonde', 'spam') RETURNING id INTO t2;
  INSERT INTO public.support_tickets (user_id, type, title, status) VALUES (u_autre, 'question', 'Sonde à soi ' || suffixe, 'open') RETURNING id INTO t3;

  -- Les gestes, sous `authenticated`, comme le navigateur de l'admin.
  SET LOCAL ROLE authenticated;

  BEGIN
    -- B1 publier une ligne : recette, ligne marquée, événement, journal.
    SELECT public.admin_publier_import(id1) INTO v;
    r := r || E'\nB1 publier — attendu l''identifiant de la recette : ' || coalesce(v, 'RIEN ⚠');
    SELECT origin || '/' || status || '/' || (name ->> 'fr') || '/' || array_to_string(allergens, ',') INTO v FROM public.recipes_unified WHERE id = 'sonde-' || suffixe || '-1';
    r := r || E'\nB2 la recette — attendu official/published/Sonde un/gluten : ' || coalesce(v, 'ABSENTE ⚠');
    SELECT status || '/' || (resolved_by = u_admin)::text || '/' || coalesce(published_recipe_id, '') INTO v FROM public.recipe_imports_staging WHERE id = id1;
    r := r || E'\nB3 la ligne de transit — attendu published/true/sonde-…-1 : ' || v;
    SELECT count(*) INTO n FROM public.recipe_import_events WHERE staging_id = id1 AND event_type = 'published' AND actor_id = u_admin;
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE action = 'recipe_import_published' AND target_id = 'sonde-' || suffixe || '-1' AND user_id = u_admin;
    r := r || E'\nB4 événement « published » par l''admin / ligne du journal — attendu 1/1 : ' || n || '/' || n2;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB1-B4 publier une ligne : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  -- B5 la vraie ligne copiée : chaque champ de la recette = parsed_data.
  BEGIN
    PERFORM public.admin_publier_import(id6);
    SELECT ((r2.name = s.parsed_data -> 'name')::int + (r2.description = s.parsed_data -> 'description')::int
            + (r2.ingredients = s.parsed_data -> 'ingredients')::int + (r2.steps = s.parsed_data -> 'steps')::int
            + (r2.diet = s.parsed_data -> 'diet')::int
            + (r2.allergens = ARRAY(SELECT jsonb_array_elements_text(s.parsed_data -> 'allergens')))::int
            + (r2.functional_tags = ARRAY(SELECT jsonb_array_elements_text(s.parsed_data -> 'functional_tags')))::int
            + (r2.time_min = (s.parsed_data ->> 'time_min')::int)::int + (r2.servings = (s.parsed_data ->> 'servings')::int)::int
            + (r2.difficulty = s.parsed_data ->> 'difficulty')::int + (r2.type = s.parsed_data ->> 'type')::int
            + (r2.country = s.parsed_data ->> 'country')::int + (r2.emoji = s.parsed_data ->> 'emoji')::int)::text
      INTO v
      FROM public.recipe_imports_staging s JOIN public.recipes_unified r2 ON r2.id = s.parsed_data ->> 'id'
     WHERE s.id = id6;
    r := r || E'\nB5 une vraie ligne du pipeline copiée et publiée : champs égaux à parsed_data — attendu 13/13 : ' || coalesce(v, '? ⚠') || '/13';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB5 une vraie ligne du pipeline copiée : REFUSÉE ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 120);
  END;

  BEGIN
    PERFORM public.admin_publier_import(id1);
    r := r || E'\nB6 publier deux fois — attendu refusé (22023) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    r := r || E'\nB6 publier deux fois — attendu refusé (22023) : refusé';
  END;
  BEGIN
    PERFORM public.admin_publier_import(gen_random_uuid());
    r := r || E'\nB7 publier une ligne inconnue — attendu refusé (P0002) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    r := r || E'\nB7 publier une ligne inconnue — attendu refusé (P0002) : refusé';
  END;
  BEGIN
    PERFORM public.admin_publier_import(id4);
    r := r || E'\nB8 publier sans identifiant de recette — attendu refusé (22023) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    r := r || E'\nB8 publier sans identifiant de recette — attendu refusé (22023) : refusé';
  END;
  SELECT status INTO v FROM public.recipe_imports_staging WHERE id = id4;
  r := r || E'\nB9 la ligne sans identifiant après le refus — attendu valid (rien n''a bougé) : ' || v;

  BEGIN
    -- B10 rejeter : motif obligatoire, puis motif écrit, événement, journal ; pas deux fois.
    BEGIN
      PERFORM public.admin_rejeter_import(id5, '   ');
      r := r || E'\nB10 rejeter sans motif — attendu refusé (22023) : ACCEPTÉ ⚠';
    EXCEPTION WHEN SQLSTATE '22023' THEN
      r := r || E'\nB10 rejeter sans motif — attendu refusé (22023) : refusé';
    END;
    PERFORM public.admin_rejeter_import(id5, '  doublon  ');
    SELECT status || '/' || coalesce(admin_notes, '') || '/' || (resolved_by = u_admin)::text INTO v FROM public.recipe_imports_staging WHERE id = id5;
    r := r || E'\nB11 rejeter avec motif — attendu rejected/doublon/true : ' || v;
    SELECT count(*) INTO n FROM public.recipe_import_events WHERE staging_id = id5 AND event_type = 'rejected' AND actor_id = u_admin AND payload ->> 'reason' = 'doublon';
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE action = 'recipe_import_rejected' AND target_id = id5::text AND user_id = u_admin;
    r := r || E'\nB12 événement « rejected » / ligne du journal — attendu 1/1 : ' || n || '/' || n2;
    BEGIN
      PERFORM public.admin_rejeter_import(id5, 'encore');
      r := r || E'\nB13 rejeter une ligne déjà résolue — attendu refusé (22023) : ACCEPTÉ ⚠';
    EXCEPTION WHEN SQLSTATE '22023' THEN
      r := r || E'\nB13 rejeter une ligne déjà résolue — attendu refusé (22023) : refusé';
    END;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB10-B13 rejeter : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    -- B14 le lot : deux lignes passent, celle sans identifiant est nommée.
    SELECT public.admin_publier_lot_import(lot) INTO bilan;
    r := r || E'\nB14 publier le lot — attendu 2 publiées, 1 échec nommé : ' || (bilan ->> 'published') || ' publiée(s), '
         || jsonb_array_length(bilan -> 'failed') || ' échec(s)' || CASE WHEN jsonb_array_length(bilan -> 'failed') = 1 THEN ' (' || (bilan -> 'failed' -> 0 ->> 'error') || ')' ELSE '' END;
    SELECT count(*) INTO n FROM public.recipes_unified WHERE id LIKE 'sonde-' || suffixe || '-%';
    r := r || E'\nB15 recettes de la sonde « sonde-… » publiées en tout — attendu 3 : ' || n;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB14-B15 le lot : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    -- B16 les compteurs, en une lecture.
    SELECT public.admin_compteurs() INTO compteurs;
    r := r || E'\nB16 compteurs — attendu neuf clés : ' || (SELECT count(*) FROM jsonb_object_keys(compteurs)) || ' ; base_recipes ' || (compteurs ->> 'base_recipes')
         || ', users ' || (compteurs ->> 'users') || ', pending ' || (compteurs ->> 'pending') || ', tickets_open ' || (compteurs ->> 'tickets_open')
         || ', tickets_unread ' || (compteurs ->> 'tickets_unread') || ', reports_open ' || (compteurs ->> 'reports_open')
         || ', santé ' || (compteurs ->> 'health_recipes') || '+' || (compteurs ->> 'health_ingredients');
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB16 compteurs : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    -- B17 l'activité par jour : la somme des actions égale le comptage direct.
    SELECT coalesce(sum(a.actions), 0), count(*) INTO n, n2 FROM public.admin_activite_par_jour(now() - interval '30 days') a;
    r := r || E'\nB17 activité sur 30 jours — ' || n2 || ' jour(s), ' || n || ' action(s) ; comptage direct du journal : '
         || (SELECT count(*) FROM public.activity_logs WHERE created_at >= now() - interval '30 days') || ' (attendu égal)';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB17 activité : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    -- B18 la bascule : updated_by et updated_at viennent de la base.
    UPDATE public.feature_flags SET enabled = enabled, updated_by = NULL, updated_at = '2000-01-01'
     WHERE key = (SELECT key FROM public.feature_flags ORDER BY key LIMIT 1)
     RETURNING (updated_by = u_admin), (updated_at > now() - interval '1 minute') INTO b, b2;
    r := r || E'\nB18 bascule : updated_by = admin / updated_at = maintenant malgré les valeurs envoyées — attendu true/true : ' || coalesce(b::text, 'NULL ⚠') || '/' || coalesce(b2::text, 'NULL ⚠');
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB18 bascule : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    -- B19 à B21 les suppressions de l'admin : un message de membre, puis le
    -- ticket (le message restant, emporté avec lui, n'a pas de ligne), puis un signalement.
    DELETE FROM public.support_messages WHERE id = m1;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE action = 'support_message_deleted' AND target_id = m1::text AND user_id = u_admin AND metadata ->> 'from_admin' = 'false';
    r := r || E'\nB19 l''admin retire un message de membre — attendu 1 supprimé / 1 ligne (from_admin false) : ' || n || '/' || n2;
    DELETE FROM public.support_tickets WHERE id = t1;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE action = 'ticket_deleted' AND target_id = t1::text AND user_id = u_admin AND metadata ->> 'type' = 'question';
    r := r || E'\nB20 l''admin supprime le ticket — attendu 1 supprimé / 1 ligne « ticket_deleted » / 0 ligne pour le message emporté : ' || n || '/' || n2 || '/'
         || (SELECT count(*) FROM public.activity_logs WHERE action = 'support_message_deleted' AND target_id = m2::text);
    DELETE FROM public.support_tickets WHERE id = t2;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE action = 'report_deleted' AND target_id = t2::text AND user_id = u_admin;
    r := r || E'\nB21 l''admin supprime le signalement — attendu 1 supprimé / 1 ligne « report_deleted » : ' || n || '/' || n2;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB19-B21 suppressions de l''admin : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  RESET ROLE;

  -- ── C. Un compte ordinaire, puis un visiteur ───────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_autre, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    DELETE FROM public.support_tickets WHERE id = t3;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT count(*) INTO n2 FROM public.activity_logs WHERE target_id = t3::text;
    r := r || E'\nC1 le membre supprime son propre ticket — attendu 1 supprimé / 0 ligne au journal : ' || n || '/' || n2;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nC1 le membre supprime son ticket : ERREUR ⚠ ' || SQLSTATE || ' ' || left(SQLERRM, 160);
  END;

  BEGIN
    PERFORM public.admin_compteurs();
    r := r || E'\nC2 compte ordinaire, compteurs — attendu refusé (42501) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    r := r || E'\nC2 compte ordinaire, compteurs — attendu refusé (42501) : refusé';
  END;
  BEGIN
    PERFORM public.admin_publier_import(id2);
    r := r || E'\nC3 compte ordinaire, publier — attendu refusé (42501) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    r := r || E'\nC3 compte ordinaire, publier — attendu refusé (42501) : refusé';
  END;
  BEGIN
    PERFORM public.admin_rejeter_import(id3, 'x');
    r := r || E'\nC4 compte ordinaire, rejeter — attendu refusé (42501) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    r := r || E'\nC4 compte ordinaire, rejeter — attendu refusé (42501) : refusé';
  END;
  BEGIN
    PERFORM count(*) FROM public.admin_activite_par_jour(now() - interval '7 days');
    r := r || E'\nC5 compte ordinaire, activité — attendu refusé (42501) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    r := r || E'\nC5 compte ordinaire, activité — attendu refusé (42501) : refusé';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.admin_compteurs();
    r := r || E'\nC6 visiteur, compteurs — attendu refusé (42501, pas le droit d''exécuter) : ACCEPTÉ ⚠';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    r := r || E'\nC6 visiteur, compteurs — attendu refusé (42501, pas le droit d''exécuter) : refusé';
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- ── D. L'effacement définitif d'un compte jetable laisse sa trace ──────────
  BEGIN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (u_jetable, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'sonde' || suffixe || '@sonde.invalid', 'sonde', now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
    DELETE FROM auth.users WHERE id = u_jetable;
    SELECT count(*) INTO n FROM public.activity_logs WHERE action = 'account_deleted' AND target_id = u_jetable::text AND user_id IS NULL;
    r := r || E'\nD1 compte jetable créé puis effacé : ligne « account_deleted » sans acteur — attendu 1 : ' || n;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nD1 compte jetable : la sonde n''a pas pu le créer ou l''effacer (' || SQLSTATE || ' ' || left(SQLERRM, 120) || ') ⚠';
  END;

  RAISE EXCEPTION 'SONDE file_d_import_et_compteurs (rien n''est écrit) :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).
