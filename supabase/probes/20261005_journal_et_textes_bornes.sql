-- Sonde du journal et des textes bornés (migration
-- 20261005_journal_et_textes_bornes.sql). Audit du 2026-10-04 : ADM-07,
-- BDD-10, une partie d'ADM-28.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau d'un compte ordinaire, de l'admin, d'un visiteur et de la clé
-- service : écrire dans le journal comme l'application le fait, puis comme
-- elle ne le fait pas ; écrire un texte à la taille maximale, puis un
-- caractère de trop ; modifier une notification.
--
-- Essai à blanc : le DDL de la migration est injecté à la place de la ligne
-- « [essai à blanc …] » ci-dessous (script de composition).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a    uuid;                      -- le compte admin
  u    uuid;                      -- un compte ordinaire
  v    uuid;                      -- un autre compte ordinaire
  rid  text;                      -- une recette officielle que u n'a pas notée
  rid2 text;                      -- une deuxième (un avis par recette)
  pid  uuid;                      -- un message de la communauté, créé par la sonde
  t    uuid;                      -- un ticket de u, créé par la sonde
  n    uuid;                      -- une notification de u, créée par la sonde
  crid text := 'sonde-rgpd-' || substr(md5(random()::text), 1, 8);
  r    text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL
     AND (community_muted_until IS NULL OR community_muted_until < now())
   ORDER BY created_at LIMIT 1;
  SELECT id INTO v FROM public.profiles
   WHERE role = 'user' AND deleted_at IS NULL AND id <> u ORDER BY created_at LIMIT 1;
  SELECT id INTO rid FROM public.recipes_unified ru
   WHERE origin = 'official' AND deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.engagement e WHERE e.target_recipe_id = ru.id AND e.user_id = u)
   ORDER BY id LIMIT 1;
  SELECT id INTO rid2 FROM public.recipes_unified ru
   WHERE origin = 'official' AND deleted_at IS NULL AND id <> rid
     AND NOT EXISTS (SELECT 1 FROM public.engagement e WHERE e.target_recipe_id = ru.id AND e.user_id = u)
   ORDER BY id LIMIT 1;
  IF a IS NULL OR u IS NULL OR v IS NULL OR rid IS NULL OR rid2 IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin, deux comptes ordinaires et une recette officielle';
  END IF;

  CREATE FUNCTION public.__sonde_ligne(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q;
      obtenu := 'ACCEPTÉ';
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  CREATE FUNCTION public.__sonde_valeur(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q INTO obtenu;
      obtenu := coalesce(obtenu, 'NULL');
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN obtenu = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  GRANT EXECUTE ON FUNCTION public.__sonde_ligne(text, text, text), public.__sonde_valeur(text, text, text)
    TO anon, authenticated, service_role;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  -- Les objets de la sonde, écrits en propriétaire (hors règles).
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.support_tickets (user_id, type, title, status, has_unread_user, has_unread_admin)
  VALUES (u, 'question', 'Sonde', 'open', false, true)
  RETURNING id INTO t;
  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, expires_at)
  VALUES (u, 'user', 'sonde', '{"fr": "Sonde"}', '{"fr": "Corps"}', now() + interval '1 day')
  RETURNING id INTO n;
  INSERT INTO public.recipes_unified (id, origin, user_id, name, moderation_status)
  VALUES (crid, 'community', u, '{"fr": "Sonde RGPD"}', 'private');
  INSERT INTO public.community_posts (user_id, category, title, body)
  VALUES (v, 'general', 'Sonde', 'Un message sur lequel réagir')
  RETURNING id INTO pid;

  ---------------------------------------------------------------------------
  -- A. Journal — un compte ordinaire écrit ce que l'application écrit pour lui
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A1 « profil consulté » (logAuditAction, lang)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata) VALUES (%L, ''profile_data_viewed'', NULL, NULL, ''{"lang": "fr"}'')', u));
  r := r || public.__sonde_ligne('A2 « données exportées » (lang, size_kb)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata) VALUES (%L, ''profile_data_exported'', NULL, NULL, ''{"lang": "fr", "size_kb": 12}'')', u));
  r := r || public.__sonde_ligne('A3 « recette soumise » (logUserAction)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''recipe_submitted'', ''custom-123'', ''recipe'')', u));
  r := r || public.__sonde_ligne('A4 « recette supprimée » (logUserAction)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''recipe_deleted'', ''custom-123'', ''recipe'')', u));
  r := r || public.__sonde_ligne('A5 « compte supprimé » (deleteAccount, cible = lui-même)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''account_soft_deleted'', %L, ''user'')', u, u));

  ---------------------------------------------------------------------------
  -- B. Journal — … et rien d'autre
  ---------------------------------------------------------------------------
  r := r || public.__sonde_ligne('B1 une action d''admin (« utilisateur banni »)', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''user_banned'', %L, ''user'')', u, v));
  r := r || public.__sonde_ligne('B2 une action permise, avec la mauvaise cible', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''recipe_deleted'', %L, ''user'')', u, v));
  r := r || public.__sonde_ligne('B3 une métadonnée de trop (« email »)', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, metadata) VALUES (%L, ''profile_data_viewed'', ''{"lang": "fr", "email": "x@y.z"}'')', u));
  r := r || public.__sonde_ligne('B4 au nom d''un autre compte', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, metadata) VALUES (%L, ''profile_data_viewed'', ''{"lang": "fr"}'')', v));
  r := r || public.__sonde_ligne('B5 « compte supprimé » visant un autre compte', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''account_soft_deleted'', %L, ''user'')', u, v));
  r := r || public.__sonde_ligne('B6 une métadonnée qui n''est pas un objet (refus net, pas une erreur)', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, metadata) VALUES (%L, ''profile_data_viewed'', ''"fr"'')', u));
  r := r || public.__sonde_ligne('B7 une forme permise, mais 3 000 octets de métadonnées', 'REFUSÉ 23514',
    format('INSERT INTO public.activity_logs (user_id, action, metadata) VALUES (%L, ''profile_data_viewed'', jsonb_build_object(''lang'', repeat(''x'', 3000)))', u));

  ---------------------------------------------------------------------------
  -- D. Journal — l'heure est celle du serveur
  ---------------------------------------------------------------------------
  r := r || public.__sonde_ligne('D1 une ligne datée de 2099 est acceptée…', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, metadata, created_at) VALUES (%L, ''profile_data_viewed'', ''{"lang": "sonde-d1"}'', ''2099-01-01'')', u));

  ---------------------------------------------------------------------------
  -- E. Journal — les fonctions serveur écrivent comme avant
  ---------------------------------------------------------------------------
  r := r || public.__sonde_ligne('E1 le compte supprime sa recette (delete_custom_recipe_rgpd)', 'ACCEPTÉ',
    format('SELECT public.delete_custom_recipe_rgpd(%L)', crid));
  RESET ROLE;
  r := r || public.__sonde_valeur('D2 … mais à l''heure du serveur', 'oui',
    format('SELECT CASE WHEN max(created_at) < now() + interval ''1 minute'' THEN ''oui'' ELSE max(created_at)::text END FROM public.activity_logs WHERE user_id = %L AND metadata->>''lang'' = ''sonde-d1''', u));
  r := r || public.__sonde_valeur('E2 … et la ligne « supprimée (RGPD) » est au journal', '1',
    format('SELECT count(*)::text FROM public.activity_logs WHERE action = ''recipe_self_deleted_rgpd'' AND target_id = %L', crid));

  ---------------------------------------------------------------------------
  -- C. Journal — l'admin
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 l''admin écrit au nom d''un autre compte', 'REFUSÉ 42501',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''user_banned'', %L, ''user'')', u, u));
  r := r || public.__sonde_ligne('C2 l''admin écrit une action d''admin sous son nom (logAdminAction)', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type) VALUES (%L, ''user_banned'', %L, ''user'')', a, u));
  r := r || public.__sonde_ligne('C3 l''admin écrit 3 000 octets de métadonnées', 'REFUSÉ 23514',
    format('INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata) VALUES (%L, ''sensitive_data_accessed'', %L, ''user.email'', jsonb_build_object(''reason'', repeat(''r'', 3000)))', a, u));
  r := r || public.__sonde_ligne('C4 l''admin écrit une action hors format', 'REFUSÉ 23514',
    format('INSERT INTO public.activity_logs (user_id, action) VALUES (%L, ''Pas Un Format !'')', a));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- F. Journal — la clé service (fonction edge auto-translate-deepl)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  r := r || public.__sonde_ligne('F1 la ligne « traduction automatique » de la fonction edge', 'ACCEPTÉ',
    format('INSERT INTO public.activity_logs (user_id, action, target_type, metadata) VALUES (%L, ''i18n_auto_translated'', NULL, ''{"source_lang": "fr", "target_langs": ["en", "es", "de", "ja"], "chars_count": 120, "success_count": 4, "error_count": 0}'')', a));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- G. Textes — la taille maximale passe, un caractère de plus non
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('G1 un avis de 2 001 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.engagement (user_id, type, target_recipe_id, rating, body) VALUES (%L, ''review'', %L, 4, repeat(''a'', 2001))', u, rid));
  r := r || public.__sonde_ligne('G2 un avis de 2 000 caractères (la limite du formulaire)', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_recipe_id, rating, body) VALUES (%L, ''review'', %L, 4, repeat(''a'', 2000))', u, rid2));
  r := r || public.__sonde_ligne('G3 une réaction de 17 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.engagement (user_id, type, target_post_id, emoji) VALUES (%L, ''reaction'', %L, repeat(''x'', 17))', u, pid));
  r := r || public.__sonde_ligne('G4 un message de support de 5 001 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, repeat(''m'', 5001))', t, u));
  r := r || public.__sonde_ligne('G5 un message de support de 5 000 caractères', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, repeat(''m'', 5000))', t, u));
  r := r || public.__sonde_ligne('G6 un titre de ticket de 201 caractères', 'REFUSÉ 23514',
    format('UPDATE public.support_tickets SET title = repeat(''t'', 201) WHERE id = %L', t));
  r := r || public.__sonde_ligne('G7 une cible de ticket de 129 caractères', 'REFUSÉ 23514',
    format('UPDATE public.support_tickets SET target_id = repeat(''c'', 129) WHERE id = %L', t));
  r := r || public.__sonde_ligne('G8 un panier partagé de 80 Ko', 'REFUSÉ 23514',
    format('INSERT INTO public.shared_baskets (user_id, payload) VALUES (%L, jsonb_build_object(''rows'', (SELECT jsonb_agg(jsonb_build_object(''label'', repeat(''x'', 100))) FROM generate_series(1, 700))))', u));
  r := r || public.__sonde_ligne('G9 un panier partagé ordinaire', 'ACCEPTÉ',
    format('INSERT INTO public.shared_baskets (user_id, payload) VALUES (%L, ''{"rows": [{"label": "Tomates", "emoji": "🍅", "amount": 2}], "total": 3.2, "lang": "fr"}'')', u));
  r := r || public.__sonde_ligne('G10 un message de la communauté lié à une recette de 101 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.community_posts (user_id, category, title, body, recipe_id) VALUES (%L, ''general'', ''Sonde titre'', ''Un corps de message assez long'', repeat(''r'', 101))', u));
  r := r || public.__sonde_ligne('G11 un avatar de 33 caractères (servi à tous)', 'REFUSÉ 23514',
    format('UPDATE public.profiles SET avatar_id = repeat(''a'', 33) WHERE id = %L', u));
  r := r || public.__sonde_ligne('G12 une bannière de 33 caractères', 'REFUSÉ 23514',
    format('UPDATE public.profiles SET banner_id = repeat(''b'', 33) WHERE id = %L', u));
  r := r || public.__sonde_ligne('G13 un avatar du catalogue', 'ACCEPTÉ',
    format('UPDATE public.profiles SET avatar_id = ''sushi'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('G14 une recette (écrite directement) au nom de 3 000 octets', 'REFUSÉ 23514',
    format('INSERT INTO public.recipes_unified (id, origin, user_id, name, moderation_status) VALUES (''sonde-g14'', ''community'', %L, jsonb_build_object(''fr'', repeat(''n'', 3000)), ''private'')', u));
  r := r || public.__sonde_ligne('G15 une recette aux étapes de 45 Ko', 'REFUSÉ 23514',
    format('INSERT INTO public.recipes_unified (id, origin, user_id, name, moderation_status, steps) VALUES (''sonde-g15'', ''community'', %L, ''{"fr": "Sonde"}'', ''private'', (SELECT jsonb_agg(repeat(''e'', 150)) FROM generate_series(1, 300)))', u));
  r := r || public.__sonde_ligne('G16 une recette au titre de 201 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.recipes_unified (id, origin, user_id, name, moderation_status, title) VALUES (''sonde-g16'', ''community'', %L, ''{"fr": "Sonde"}'', ''private'', repeat(''t'', 201))', u));
  r := r || public.__sonde_ligne('G17 une recette à l''identifiant de 101 caractères', 'REFUSÉ 23514',
    format('INSERT INTO public.recipes_unified (id, origin, user_id, name, moderation_status) VALUES (repeat(''i'', 101), ''community'', %L, ''{"fr": "Sonde"}'', ''private'')', u));
  r := r || public.__sonde_ligne('G18 par la vue de l''application : 120 étapes accentuées (36 Ko)', 'REFUSÉ 23514',
    format('INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote) VALUES (''sonde-g18'', %L, ''Sonde'', jsonb_build_object(''name'', ''Sonde'', ''steps'', (SELECT jsonb_agg(repeat(''é'', 150)) FROM generate_series(1, 120))), ''private'', false, false)', u));
  r := r || public.__sonde_ligne('G19 par la vue : une recette de 30 étapes pleines (le plafond du formulaire)', 'ACCEPTÉ',
    format('INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote) VALUES (''sonde-g19'', %L, ''Sonde'', jsonb_build_object(''name'', ''Sonde'', ''steps'', (SELECT jsonb_agg(repeat(''é'', 150)) FROM generate_series(1, 30))), ''private'', false, false)', u));

  ---------------------------------------------------------------------------
  -- H. Notifications — le destinataire ne change que « lue »
  ---------------------------------------------------------------------------
  r := r || public.__sonde_ligne('H1 marquer sa notification lue (markNotificationRead)', 'ACCEPTÉ',
    format('UPDATE public.notifications SET read_at = now() WHERE id = %L AND read_at IS NULL', n));
  r := r || public.__sonde_ligne('H2 tout marquer lu (markAllNotificationsRead)', 'ACCEPTÉ',
    'UPDATE public.notifications SET read_at = now() WHERE read_at IS NULL');
  r := r || public.__sonde_ligne('H3 réécrire le titre de sa notification', 'REFUSÉ 42501',
    format('UPDATE public.notifications SET title = ''{"fr": "Réécrit"}'' WHERE id = %L', n));
  r := r || public.__sonde_ligne('H4 repousser son expiration de dix ans', 'REFUSÉ 42501',
    format('UPDATE public.notifications SET expires_at = now() + interval ''10 years'' WHERE id = %L', n));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- G'. Textes — un visiteur (suivi d'usage)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_ligne('G20 un visiteur, identifiant anonyme de 65 caractères', 'REFUSÉ 23514',
    'INSERT INTO public.product_events (event, anon_id) VALUES (''recipe_opened'', repeat(''x'', 65))');
  r := r || public.__sonde_ligne('G21 un visiteur, identifiant anonyme ordinaire (36)', 'ACCEPTÉ',
    'INSERT INTO public.product_events (event, anon_id) VALUES (''recipe_opened'', ''7f1c9a52-0d3e-4b6a-9c11-2b8e5f4a7d90'')');
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- I. La forme
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('I1 la liste blanche ne s''appelle pas en visiteur, s''appelle connecté', 'false true',
    'SELECT has_function_privilege(''anon'', ''private.entree_de_journal_permise(uuid, text, text, text, jsonb)'', ''EXECUTE'')::text || '' '' || has_function_privilege(''authenticated'', ''private.entree_de_journal_permise(uuid, text, text, text, jsonb)'', ''EXECUTE'')::text');
  r := r || public.__sonde_valeur('I2 le déclencheur d''horodatage est posé', '1',
    'SELECT count(*)::text FROM pg_trigger WHERE tgname = ''trg_horodater_le_journal'' AND tgrelid = ''public.activity_logs''::regclass');
  r := r || public.__sonde_valeur('I3 notifications : le droit de modifier se limite à read_at', 'read_at',
    'SELECT string_agg(column_name, '','' ORDER BY column_name) FROM information_schema.column_privileges WHERE table_schema = ''public'' AND table_name = ''notifications'' AND grantee = ''authenticated'' AND privilege_type = ''UPDATE''');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).