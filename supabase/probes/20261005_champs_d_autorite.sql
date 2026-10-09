-- Sonde des champs d'autorité (migration 20261005_champs_d_autorite_gardes.sql).
-- Audit du 2026-10-04 : BDD-14.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau de l'auteur d'un message, d'un autre membre, du propriétaire
-- d'un ticket et de l'admin : réécrire un compteur, aimer et répondre (le
-- recomptage doit suivre), ouvrir un ticket comme la production le fait,
-- changer ce qui revient au support, poser la date de la charte.
--
-- Essai à blanc : le DDL de la migration est injecté à la place de la ligne
-- « [essai à blanc …] » ci-dessous (script de composition).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a    uuid;                      -- le compte admin
  u    uuid;                      -- un compte ordinaire (auteur, propriétaire)
  v    uuid;                      -- un autre compte ordinaire
  pid  uuid;                      -- un message de u, créé par la sonde
  rpid uuid;                      -- une réponse de u, créée par la sonde
  t    uuid;                      -- le ticket « Sonde B1 » de u
  r    text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL
     AND (community_muted_until IS NULL OR community_muted_until < now())
   ORDER BY created_at LIMIT 1;
  SELECT id INTO v FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL AND id <> u
     AND (community_muted_until IS NULL OR community_muted_until < now())
   ORDER BY created_at LIMIT 1;
  IF a IS NULL OR u IS NULL OR v IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin et deux comptes ordinaires en règle';
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
  INSERT INTO public.community_posts (user_id, category, title, body)
  VALUES (u, 'general', 'Sonde', 'Un message de la sonde')
  RETURNING id INTO pid;
  INSERT INTO public.community_replies (post_id, user_id, body)
  VALUES (pid, u, 'Une réponse de la sonde')
  RETURNING id INTO rpid;
  -- Place pour trois tickets ouverts (plafond) ; charte non acceptée.
  UPDATE public.support_tickets SET status = 'resolved' WHERE user_id = u AND status <> 'resolved';
  UPDATE public.profiles SET community_terms_accepted_at = NULL WHERE id = u;

  ---------------------------------------------------------------------------
  -- A. Compteurs — l'auteur ne les écrit pas, le recomptage suit
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A1 l''auteur met ses « j''aime » à 999', 'REFUSÉ 42501',
    format('UPDATE public.community_posts SET likes_count = 999 WHERE id = %L', pid));
  r := r || public.__sonde_ligne('A2 l''auteur met ses réponses à 999', 'REFUSÉ 42501',
    format('UPDATE public.community_posts SET replies_count = 999 WHERE id = %L', pid));
  r := r || public.__sonde_ligne('A3 l''auteur corrige son titre', 'ACCEPTÉ',
    format('UPDATE public.community_posts SET title = ''Titre corrigé'' WHERE id = %L', pid));
  r := r || public.__sonde_ligne('A4 l''auteur met les « j''aime » de sa réponse à 999', 'REFUSÉ 42501',
    format('UPDATE public.community_replies SET likes_count = 999 WHERE id = %L', rpid));
  r := r || public.__sonde_ligne('A5 l''auteur corrige sa réponse', 'ACCEPTÉ',
    format('UPDATE public.community_replies SET body = ''Réponse corrigée'' WHERE id = %L', rpid));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A6 un autre membre réagit au message', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_post_id, emoji) VALUES (%L, ''reaction'', %L, ''❤️'')', v, pid));
  r := r || public.__sonde_ligne('A7 … et lui répond', 'ACCEPTÉ',
    format('INSERT INTO public.community_replies (post_id, user_id, body) VALUES (%L, %L, ''Bravo'')', pid, v));
  RESET ROLE;
  r := r || public.__sonde_valeur('A8 … les compteurs suivent (1 « j''aime », 2 réponses)', '1 2',
    format('SELECT likes_count || '' '' || replies_count FROM public.community_posts WHERE id = %L', pid));

  ---------------------------------------------------------------------------
  -- B. Tickets — ce qui revient au support reste au support
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B1 ouvrir un ticket comme la production (sans « non lu par l''admin »)', 'ACCEPTÉ',
    format('INSERT INTO public.support_tickets (user_id, type, title, status, has_unread_user) VALUES (%L, ''question'', ''Sonde B1'', ''open'', false)', u));
  r := r || public.__sonde_ligne('B2 ouvrir un ticket déjà « résolu » et « lu par l''admin »', 'ACCEPTÉ',
    format('INSERT INTO public.support_tickets (user_id, type, title, status, has_unread_admin, has_unread_user) VALUES (%L, ''question'', ''Sonde B2'', ''resolved'', false, true)', u));
  r := r || public.__sonde_ligne('B3 ouvrir un ticket par ouvrir_ticket (dev)', 'ACCEPTÉ',
    'SELECT public.ouvrir_ticket(''question'', ''Sonde B3'', ''Ma question'')');
  RESET ROLE;
  SELECT id INTO t FROM public.support_tickets WHERE user_id = u AND title = 'Sonde B1';
  r := r || public.__sonde_valeur('B1'' … il naît ouvert, non lu par l''admin, lu par son auteur', 'open true false',
    format('SELECT status || '' '' || has_unread_admin || '' '' || has_unread_user FROM public.support_tickets WHERE id = %L', t));
  r := r || public.__sonde_valeur('B2'' … même demandé « résolu » et « lu par l''admin »', 'open true false',
    format('SELECT status || '' '' || has_unread_admin || '' '' || has_unread_user FROM public.support_tickets WHERE user_id = %L AND title = ''Sonde B2''', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B4 son auteur renomme le ticket (updateTicketTitle)', 'ACCEPTÉ',
    format('UPDATE public.support_tickets SET title = ''Titre renommé'' WHERE id = %L', t));
  r := r || public.__sonde_ligne('B5 son auteur le marque lu (markTicketReadByUser)', 'ACCEPTÉ',
    format('UPDATE public.support_tickets SET has_unread_user = false WHERE id = %L', t));
  r := r || public.__sonde_ligne('B6 son auteur le déclare résolu', 'REFUSÉ 42501',
    format('UPDATE public.support_tickets SET status = ''resolved'' WHERE id = %L', t));
  r := r || public.__sonde_ligne('B7 son auteur éteint le badge de l''admin', 'REFUSÉ 42501',
    format('UPDATE public.support_tickets SET has_unread_admin = false WHERE id = %L', t));
  r := r || public.__sonde_ligne('B8 son auteur l''allume (la production, après un message)', 'ACCEPTÉ',
    format('UPDATE public.support_tickets SET has_unread_admin = true WHERE id = %L', t));
  r := r || public.__sonde_ligne('B9 son auteur en change le type', 'REFUSÉ 42501',
    format('UPDATE public.support_tickets SET type = ''report'' WHERE id = %L', t));
  r := r || public.__sonde_ligne('B10 son auteur en change la cible', 'REFUSÉ 42501',
    format('UPDATE public.support_tickets SET target_id = ''autre-cible'' WHERE id = %L', t));
  r := r || public.__sonde_ligne('B11 son auteur en change le motif', 'REFUSÉ 42501',
    format('UPDATE public.support_tickets SET reason_key = ''spam'' WHERE id = %L', t));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B12 l''admin le lit (markTicketReadByAdmin)', 'ACCEPTÉ',
    format('UPDATE public.support_tickets SET has_unread_admin = false WHERE id = %L', t));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B13 son auteur relance par un message', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''Une relance'')', t, u));
  RESET ROLE;
  r := r || public.__sonde_valeur('B14 … le ticket redevient « non lu par l''admin » (déclencheur, profondeur 2)', 'true',
    format('SELECT has_unread_admin::text FROM public.support_tickets WHERE id = %L', t));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B15 l''admin le résout (adminSetTicketStatus)', 'ACCEPTÉ',
    format('UPDATE public.support_tickets SET status = ''resolved'', has_unread_admin = false WHERE id = %L', t));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- C. Charte de la communauté — l'heure du serveur, une preuve qui ne bouge pas
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 accepter la charte avec une date antidatée (2020)', 'ACCEPTÉ',
    format('UPDATE public.profiles SET community_terms_accepted_at = ''2020-01-01'' WHERE id = %L', u));
  RESET ROLE;
  r := r || public.__sonde_valeur('C1'' … la date gardée est celle du serveur', 'heure du serveur',
    format('SELECT CASE WHEN community_terms_accepted_at > now() - interval ''1 minute'' THEN ''heure du serveur'' ELSE community_terms_accepted_at::text END FROM public.profiles WHERE id = %L', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C2 la réécrire en 2030', 'ACCEPTÉ',
    format('UPDATE public.profiles SET community_terms_accepted_at = ''2030-01-01'' WHERE id = %L', u));
  RESET ROLE;
  r := r || public.__sonde_valeur('C2'' … la preuve n''a pas bougé', 'heure du serveur',
    format('SELECT CASE WHEN community_terms_accepted_at > now() - interval ''1 minute'' AND community_terms_accepted_at < now() + interval ''1 minute'' THEN ''heure du serveur'' ELSE community_terms_accepted_at::text END FROM public.profiles WHERE id = %L', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C3 la retirer (revokeCommunityTerms)', 'ACCEPTÉ',
    format('UPDATE public.profiles SET community_terms_accepted_at = NULL WHERE id = %L', u));
  RESET ROLE;
  r := r || public.__sonde_valeur('C3'' … elle est retirée', 'NULL',
    format('SELECT community_terms_accepted_at::text FROM public.profiles WHERE id = %L', u));
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_ligne('C4 une écriture serveur pose une date', 'ACCEPTÉ',
    format('UPDATE public.profiles SET community_terms_accepted_at = ''2026-01-01 00:00:00+00'' WHERE id = %L', u));
  r := r || public.__sonde_valeur('C4'' … elle est gardée telle quelle', '2026-01-01 00:00:00+00',
    format('SELECT community_terms_accepted_at::text FROM public.profiles WHERE id = %L', u));

  ---------------------------------------------------------------------------
  -- D. La forme
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('D1 les fonctions des gardes ne s''appellent pas depuis l''API', 'false false false',
    'SELECT has_function_privilege(''authenticated'', ''private.garder_les_compteurs()'', ''EXECUTE'')::text || '' '' || has_function_privilege(''authenticated'', ''private.garder_le_ticket()'', ''EXECUTE'')::text || '' '' || has_function_privilege(''authenticated'', ''private.horodater_la_charte()'', ''EXECUTE'')::text');
  r := r || public.__sonde_valeur('D2 les quatre déclencheurs sont posés', '4',
    'SELECT count(*)::text FROM pg_trigger WHERE tgname IN (''trg_garder_les_compteurs'', ''trg_garder_le_ticket'', ''trg_horodater_la_charte'')');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).