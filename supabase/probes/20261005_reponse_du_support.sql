-- Sonde de la réponse du support (migration
-- 20261005_reponse_du_support_en_une_ecriture.sql). Audit du 2026-10-04 :
-- ADM-02 ; plus un constat hors audit du 2026-10-05.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau d'un compte ordinaire (son propre ticket) puis de l'admin :
-- écrire un message comme l'écran le fait, essayer d'écrire « au nom du
-- support », ouvrir un ticket, répondre — et regarder le ticket.
--
-- Essai à blanc : coller le corps de la migration (sans BEGIN / COMMIT) à la
-- place de la ligne « [essai à blanc …] » ci-dessous.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a   uuid;                      -- le compte admin
  u   uuid;                      -- un compte ordinaire
  v   uuid;                      -- un autre compte ordinaire
  t   uuid;                      -- un ticket de u, créé par la sonde
  r   text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v FROM public.profiles
   WHERE role = 'user' AND deleted_at IS NULL AND id <> u ORDER BY created_at LIMIT 1;
  IF a IS NULL OR u IS NULL OR v IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin et deux comptes ordinaires';
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

  GRANT EXECUTE ON FUNCTION public.__sonde_ligne(text, text, text), public.__sonde_valeur(text, text, text) TO anon, authenticated;

  -- [essai à blanc : le corps de la migration se colle ici]

  -- Le ticket de la sonde, écrit en propriétaire (hors règles et hors plafond).
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.support_tickets (user_id, type, title, status, has_unread_user, has_unread_admin)
  VALUES (u, 'question', 'Sonde', 'open', false, true)
  RETURNING id INTO t;

  ---------------------------------------------------------------------------
  -- A. Un compte ordinaire, dans son propre ticket
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A1 il écrit un message comme l''écran le fait (sendUserMessage)', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''Une précision'')', t, u));
  r := r || public.__sonde_ligne('A2 … mais pas « au nom du support »', 'REFUSÉ 42501',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, true, ''Réponse du support : …'')', t, u));
  r := r || public.__sonde_ligne('A3 … ni au nom d''un autre compte', 'REFUSÉ 42501',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''Signé : un autre'')', t, v));
  r := r || public.__sonde_ligne('A4 … ni sans expéditeur', 'REFUSÉ 42501',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, NULL, false, ''Anonyme'')', t));
  r := r || public.__sonde_ligne('A5 ouvrir un ticket par ouvrir_ticket marche toujours', 'ACCEPTÉ',
    'SELECT public.ouvrir_ticket(''question'', ''Sonde 2'', ''Ma question'')');
  RESET ROLE;
  r := r || public.__sonde_valeur('A6 … et aucun message « du support » ne s''est glissé dans son ticket', '0',
    format('SELECT count(*)::text FROM public.support_messages WHERE ticket_id = %L AND is_admin', t));

  ---------------------------------------------------------------------------
  -- B. L'admin répond : une seule écriture, le ticket suit
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B1 l''admin répond (le message seul, comme adminReplyTicket désormais)', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, NULL, true, ''Bonjour, c''''est corrigé.'')', t));
  RESET ROLE;
  r := r || public.__sonde_valeur('B2 … le ticket est « non lu par l''utilisateur », « lu par l''admin », « en cours »', 'true false in_progress',
    format('SELECT has_unread_user::text || '' '' || has_unread_admin::text || '' '' || status FROM public.support_tickets WHERE id = %L', t));
  r := r || public.__sonde_valeur('B3 … et l''utilisateur reçoit sa notification (déclencheur existant)', '1',
    format('SELECT count(*)::text FROM public.notifications WHERE recipient_id = %L AND type = ''ticket_reply'' AND metadata->>''ticket_id'' = %L', u, t));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B4 l''utilisateur répond à son tour', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''Merci !'')', t, u));
  RESET ROLE;
  r := r || public.__sonde_valeur('B5 … le ticket redevient « non lu par l''admin » (déclencheur du 2026-10-05, inchangé)', 'true',
    format('SELECT has_unread_admin::text FROM public.support_tickets WHERE id = %L', t));

  ---------------------------------------------------------------------------
  -- C. La forme
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('C1 le déclencheur ne se réveille que pour un message du support', 'oui',
    'SELECT CASE WHEN pg_get_triggerdef(oid) LIKE ''%WHEN ((new.is_admin IS TRUE))%'' THEN ''oui'' ELSE pg_get_triggerdef(oid) END FROM pg_trigger WHERE tgname = ''trg_ticket_repondu''');
  r := r || public.__sonde_valeur('C2 la fonction ne s''appelle pas depuis l''API', 'false false',
    'SELECT has_function_privilege(''anon'', ''public.marquer_ticket_repondu()'', ''EXECUTE'')::text || '' '' || has_function_privilege(''authenticated'', ''public.marquer_ticket_repondu()'', ''EXECUTE'')::text');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-05, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT la migration : 8 écarts.
--   A2, A3, A4 : ACCEPTÉ — un compte ordinaire écrit dans son ticket un message
--     « du support », ou signé d'un autre compte, ou sans expéditeur.
--   A6 = 1 : le faux message du support est bien là.
--   B2 = « false true open » : le message de l'admin seul ne touche pas le
--     ticket (c'était au navigateur de faire une seconde écriture).
--   B3 = 2 : le faux message de A2 a valu à l'utilisateur une vraie
--     notification « Nouvelle réponse à ton ticket ».
--   C1, C2 : le déclencheur et la fonction n'existent pas.
--
-- ESSAI À BLANC (migration collée dans le bloc) : 0 écart sur 13 gestes.
--
-- APRÈS application (`reponse_du_support_en_une_ecriture`) : 0 écart sur
--   13 gestes.
