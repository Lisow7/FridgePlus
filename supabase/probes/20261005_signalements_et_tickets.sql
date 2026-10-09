-- Sonde des signalements et des tickets du support (migration
-- 20261005_signalements_et_tickets_qui_aboutissent.sql). Hors audit du
-- 2026-10-04, lot 7e.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Elle joue, dans la peau d'un compte ordinaire, EXACTEMENT ce que le
-- navigateur envoie : l'ancienne écriture des signalements de la communauté
-- (v0.145), puis la fonction `ouvrir_ticket` avec les arguments de
-- `createReport` et de `createTicket`. Puis le plafond de 3 tickets ouverts,
-- un compte banni, l'indivisibilité « ticket + message », le drapeau « non lu
-- par l'admin », et les droits (visiteur, autre compte).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a   uuid;                      -- le compte admin
  u   uuid;                      -- un compte ordinaire, sans ticket ouvert
  v   uuid;                      -- un autre compte ordinaire
  b   uuid;                      -- un compte que la sonde bannit
  t   uuid;                      -- un ticket de la sonde
  s   text := substr(md5(random()::text), 1, 6);   -- marque de cette exécution
  r   text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT p.id INTO u FROM public.profiles p
   WHERE p.role = 'user' AND COALESCE(p.banned, false) = false AND p.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.support_tickets x WHERE x.user_id = p.id AND x.status IN ('open', 'in_progress'))
   ORDER BY p.created_at LIMIT 1;
  SELECT p.id INTO v FROM public.profiles p
   WHERE p.role = 'user' AND COALESCE(p.banned, false) = false AND p.deleted_at IS NULL AND p.id <> u
   ORDER BY p.created_at LIMIT 1;
  SELECT p.id INTO b FROM public.profiles p
   WHERE p.role = 'user' AND COALESCE(p.banned, false) = false AND p.deleted_at IS NULL AND p.id NOT IN (u, v)
   ORDER BY p.created_at LIMIT 1;
  IF a IS NULL OR u IS NULL OR v IS NULL OR b IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin et trois comptes ordinaires (dont un sans ticket ouvert)';
  END IF;

  -- Joue une écriture et rend une ligne de rapport. `attendu` est le DÉBUT du
  -- résultat espéré (« ACCEPTÉ », « REFUSÉ 42501 »).
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

  -- Lit une valeur (rendue en texte) et la compare au début attendu.
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
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  ---------------------------------------------------------------------------
  -- A. Les signalements, tels que le navigateur les envoie
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- L'écriture de la v0.145 (`reportPost`, `reportReply`, `reportProfile`, `reportReview`) :
  r := r || public.__sonde_ligne('A0 ancienne écriture d''un signalement (colonne body, sans title)', 'REFUSÉ 42703',
    format('INSERT INTO public.support_tickets (user_id, type, target_type, target_id, reason_key, body, status) VALUES (%L, ''report'', ''community_post'', ''p-%s'', ''spam'', NULL, ''open'')', u, s));
  r := r || public.__sonde_ligne('A1 signaler un post (createReport)', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''report'', ''Signalement : post de la communauté (spam)'', ''Pub répétée %s'', ''community_post'', ''p-%s'', ''spam'')', s, s));
  r := r || public.__sonde_ligne('A2 signaler une réponse', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''report'', ''Signalement : réponse de la communauté (harassment)'', NULL, ''community_reply'', ''rep-%s'', ''harassment'')', s));
  RESET ROLE;
  UPDATE public.support_tickets SET status = 'resolved' WHERE user_id = u AND created_at = now();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A3 signaler un profil', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''report'', ''Signalement : profil de la communauté (inappropriate)'', NULL, ''community_profile'', %L, ''inappropriate'')', v));
  r := r || public.__sonde_ligne('A4 signaler un avis (cible recipe_review)', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''report'', ''Signalement : avis sur une recette (wrong_info)'', NULL, ''recipe_review'', ''avis-%s'', ''wrong_info'')', s));
  r := r || public.__sonde_ligne('A5 signaler une recette (flux du panneau support)', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''report'', ''🍝 Pâtes — Spam'', NULL, ''recipe'', ''r-%s'', ''spam'')', s));
  RESET ROLE;
  r := r || public.__sonde_valeur('A6 le détail du motif est joint au signalement du post', '1',
    format('SELECT count(*)::text FROM public.support_messages m JOIN public.support_tickets x ON x.id = m.ticket_id WHERE x.user_id = %L AND x.created_at = now() AND m.content = %L AND m.is_admin = false', u, 'Pub répétée ' || s));
  r := r || public.__sonde_valeur('A7 les 5 signalements portent « non lu par l''admin »', '5 true',
    format('SELECT count(*)::text || '' '' || bool_and(has_unread_admin)::text FROM public.support_tickets WHERE user_id = %L AND created_at = now() AND type = ''report''', u));
  r := r || public.__sonde_valeur('A8 le titre est enregistré tel qu''envoyé', 'Signalement : post de la communauté (spam)',
    format('SELECT title FROM public.support_tickets WHERE user_id = %L AND created_at = now() AND target_type = ''community_post''', u));
  UPDATE public.support_tickets SET status = 'resolved' WHERE user_id = u AND created_at = now();

  ---------------------------------------------------------------------------
  -- B. Une question (createTicket) : le ticket et son texte, d'un seul coup
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B1 ouvrir une question avec son texte', 'ACCEPTÉ',
    format('SELECT public.ouvrir_ticket(''question'', ''Question %s'', ''Mon frigo est vide ?'')', s));
  r := r || public.__sonde_ligne('B2 une question SANS texte', 'REFUSÉ 22023',
    format('SELECT public.ouvrir_ticket(''question'', ''Vide %s'', ''   '')', s));
  RESET ROLE;
  r := r || public.__sonde_valeur('B3 la question a son texte et « non lu par l''admin »', '1 true',
    format('SELECT count(m.id)::text || '' '' || bool_and(x.has_unread_admin)::text FROM public.support_tickets x JOIN public.support_messages m ON m.ticket_id = x.id WHERE x.user_id = %L AND x.title = %L AND m.content = ''Mon frigo est vide ?''', u, 'Question ' || s));
  r := r || public.__sonde_valeur('B4 la question sans texte n''a laissé aucun ticket', '0',
    format('SELECT count(*)::text FROM public.support_tickets WHERE user_id = %L AND title = %L', u, 'Vide ' || s));
  -- Indivisible : si le message est refusé, le ticket n'existe pas.
  CREATE FUNCTION public.__sonde_refus_message() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN RAISE EXCEPTION 'message refusé par la sonde'; END $f$;
  CREATE TRIGGER __sonde_refus_message BEFORE INSERT ON public.support_messages
    FOR EACH ROW EXECUTE FUNCTION public.__sonde_refus_message();
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B5 le message est refusé', 'REFUSÉ P0001',
    format('SELECT public.ouvrir_ticket(''question'', ''Indivisible %s'', ''texte'')', s));
  RESET ROLE;
  r := r || public.__sonde_valeur('B6 … et le ticket n''existe pas', '0',
    format('SELECT count(*)::text FROM public.support_tickets WHERE user_id = %L AND title = %L', u, 'Indivisible ' || s));
  DROP TRIGGER __sonde_refus_message ON public.support_messages;
  DROP FUNCTION public.__sonde_refus_message();
  UPDATE public.support_tickets SET status = 'resolved' WHERE user_id = u AND created_at = now();

  ---------------------------------------------------------------------------
  -- C. Le plafond de 3 tickets ouverts tient toujours
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 1er ticket ouvert', 'ACCEPTÉ', format('SELECT public.ouvrir_ticket(''question'', ''Plafond 1 %s'', ''x'')', s));
  r := r || public.__sonde_ligne('C2 2e ticket ouvert', 'ACCEPTÉ', format('SELECT public.ouvrir_ticket(''question'', ''Plafond 2 %s'', ''x'')', s));
  r := r || public.__sonde_ligne('C3 3e ticket ouvert', 'ACCEPTÉ', format('SELECT public.ouvrir_ticket(''report'', ''Plafond 3 %s'', NULL, ''recipe'', ''r'', ''spam'')', s));
  r := r || public.__sonde_ligne('C4 4e ticket ouvert : refusé par la règle d''accès', 'REFUSÉ 42501', format('SELECT public.ouvrir_ticket(''question'', ''Plafond 4 %s'', ''x'')', s));
  RESET ROLE;
  t := (SELECT id FROM public.support_tickets WHERE user_id = u AND title = 'Plafond 1 ' || s);

  ---------------------------------------------------------------------------
  -- D. Un compte banni : refusé, et dit comme tel
  ---------------------------------------------------------------------------
  UPDATE public.profiles SET banned = true WHERE id = b;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('D1 banni : ouvrir un ticket', 'REFUSÉ P0001 account_restricted', format('SELECT public.ouvrir_ticket(''question'', ''Banni %s'', ''x'')', s));
  r := r || public.__sonde_ligne('D2 banni : l''ancienne écriture directe aussi refusée', 'REFUSÉ 42501',
    format('INSERT INTO public.support_tickets (user_id, type, title, status) VALUES (%L, ''question'', ''Banni direct %s'', ''open'')', b, s));
  RESET ROLE;
  -- La session simule encore le compte banni : sans cette remise à zéro, la garde
  -- des profils refuserait qu'il touche à sa propre colonne `banned` (elle a raison).
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET banned = false WHERE id = b;

  ---------------------------------------------------------------------------
  -- E. « Non lu par l'admin » est posé par la base, pour les messages de l'utilisateur
  ---------------------------------------------------------------------------
  UPDATE public.support_tickets SET has_unread_admin = false WHERE id = t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E1 l''utilisateur répond (sendUserMessage, insertion seule)', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''Merci'')', t, u));
  RESET ROLE;
  r := r || public.__sonde_valeur('E2 … le ticket est « non lu par l''admin »', 'true', format('SELECT has_unread_admin::text FROM public.support_tickets WHERE id = %L', t));
  UPDATE public.support_tickets SET has_unread_admin = false WHERE id = t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E3 l''admin répond', 'ACCEPTÉ',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, true, ''Réponse'')', t, a));
  RESET ROLE;
  r := r || public.__sonde_valeur('E4 … le drapeau de l''admin ne bouge pas', 'false', format('SELECT has_unread_admin::text FROM public.support_tickets WHERE id = %L', t));
  r := r || public.__sonde_valeur('E5 … et l''utilisateur reçoit sa notification (inchangé)', '1',
    format('SELECT count(*)::text FROM public.notifications WHERE recipient_id = %L AND type = ''ticket_reply'' AND created_at = now()', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E6 un autre compte écrit dans ce ticket', 'REFUSÉ 42501',
    format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, false, ''intrus'')', t, v));
  r := r || public.__sonde_valeur('E7 un autre compte ne voit pas ce ticket', '0', format('SELECT count(*)::text FROM public.support_tickets WHERE id = %L', t));

  ---------------------------------------------------------------------------
  -- F. Les droits
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_ligne('F1 un visiteur appelle ouvrir_ticket', 'REFUSÉ 42501', format('SELECT public.ouvrir_ticket(''question'', ''Visiteur %s'', ''x'')', s));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F2 un compte appelle la fonction du déclencheur', 'REFUSÉ', 'SELECT public.marquer_ticket_non_lu_admin()');
  -- La suppression par le propriétaire reste ce qu'elle est (admin seulement) :
  r := r || public.__sonde_valeur('F3 le propriétaire supprime son message : 0 ligne (règle inchangée)', '0',
    format('WITH d AS (DELETE FROM public.support_messages WHERE ticket_id = %L AND sender_id = %L AND is_admin = false RETURNING 1) SELECT count(*)::text FROM d', t, u));
  RESET ROLE;
  r := r || public.__sonde_valeur('F4 ouvrir_ticket s''exécute avec les droits de l''appelant', 'false',
    'SELECT prosecdef::text FROM pg_proc WHERE oid = ''public.ouvrir_ticket(text, text, text, text, text, text)''::regprocedure');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).