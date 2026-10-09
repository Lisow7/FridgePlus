-- Sonde du vrai bannissement (migration 20261005_bannissement_reel.sql).
-- Audit du 2026-10-04 : CPT-17, complément de BDD-02.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- ⚠ Le bloc touche une ligne de `auth.users` (verrouillée le temps du bloc,
-- moins d'une seconde) : il insère une session et un jeton de renouvellement
-- pour le compte, le bannit, et vérifie que tout a disparu. Tout est annulé.
--
-- Essai à blanc : le DDL de la migration est injecté à la place de la ligne
-- « [essai à blanc …] » ci-dessous (script de composition).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a    uuid;                      -- le compte admin
  u    uuid;                      -- le compte banni par la sonde
  v    uuid;                      -- un autre compte ordinaire
  sid  uuid := gen_random_uuid(); -- une session de u, créée par la sonde
  r    text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO v FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL AND id <> u ORDER BY created_at DESC LIMIT 1;
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

  GRANT EXECUTE ON FUNCTION public.__sonde_ligne(text, text, text), public.__sonde_valeur(text, text, text)
    TO anon, authenticated, service_role;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  -- Une session et un jeton de renouvellement pour u (annulés avec le bloc).
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES (sid, u, now(), now());
  INSERT INTO auth.refresh_tokens (token, user_id, revoked, session_id, created_at, updated_at)
  VALUES ('sonde-' || sid::text, u::text, false, sid, now(), now());

  ---------------------------------------------------------------------------
  -- A. L'admin bannit u pour 7 jours
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A1 l''admin bannit pour 7 jours, avec un motif', 'ACCEPTÉ',
    format('SELECT public.admin_bannir(%L, ''Spam répété dans la communauté'', 7)', u));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('A2 le profil porte le bannissement, le motif et la fin (≈ dans 7 jours)', 'true Spam répété dans la communauté oui',
    format('SELECT banned::text || '' '' || banned_reason || '' '' || CASE WHEN banned_until BETWEEN now() + interval ''7 days'' - interval ''1 minute'' AND now() + interval ''7 days'' + interval ''1 minute'' THEN ''oui'' ELSE coalesce(banned_until::text, ''NULL'') END FROM public.profiles WHERE id = %L', u));
  r := r || public.__sonde_valeur('A3 le service d''authentification a la même fin', 'oui',
    format('SELECT CASE WHEN u.banned_until = p.banned_until THEN ''oui'' ELSE coalesce(u.banned_until::text, ''NULL'') END FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE u.id = %L', u));
  r := r || public.__sonde_valeur('A4 la session et le jeton de renouvellement ont disparu', '0 0',
    format('SELECT (SELECT count(*) FROM auth.sessions WHERE user_id = %L)::text || '' '' || (SELECT count(*) FROM auth.refresh_tokens WHERE user_id = %L)::text', u, u::text));
  r := r || public.__sonde_valeur('A5 le journal le dit, avec le motif et la durée', '1',
    format('SELECT count(*)::text FROM public.activity_logs WHERE action = ''user_banned'' AND target_id = %L AND user_id = %L AND metadata->>''reason'' = ''Spam répété dans la communauté'' AND metadata->>''duration_days'' = ''7''', u, a));

  ---------------------------------------------------------------------------
  -- B. Pendant le bannissement
  ---------------------------------------------------------------------------
  -- `authenticated` n'a pas l'usage du schéma `private` : les règles d'accès
  -- appellent la fonction (résolue à leur création), un appel direct non. On
  -- l'interroge donc avec l'identité du compte, sans changer de rôle.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  r := r || public.__sonde_valeur('B1 le compte ne peut plus écrire', 'false',
    'SELECT private.compte_peut_ecrire()::text');
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B2 ouvrir un ticket : « compte restreint »', 'REFUSÉ P0001',
    'SELECT public.ouvrir_ticket(''question'', ''Pourquoi ?'', ''Pourquoi suis-je banni ?'')');
  r := r || public.__sonde_ligne('B3 le compte efface son motif', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET banned_reason = NULL WHERE id = %L', u));
  r := r || public.__sonde_ligne('B4 … ou avance sa date de fin', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET banned_until = now() WHERE id = %L', u));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- C. Refus
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 un compte ordinaire bannit quelqu''un', 'REFUSÉ 42501',
    format('SELECT public.admin_bannir(%L, ''Je n''''aime pas'', 1)', u));
  r := r || public.__sonde_ligne('C2 … ou débannit', 'REFUSÉ 42501',
    format('SELECT public.admin_debannir(%L)', u));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C3 l''admin se bannit lui-même', 'REFUSÉ 22023',
    format('SELECT public.admin_bannir(%L, ''Essai'', 1)', a));
  r := r || public.__sonde_ligne('C4 sans motif', 'REFUSÉ 22023',
    format('SELECT public.admin_bannir(%L, ''   '', 1)', v));
  r := r || public.__sonde_ligne('C5 un motif de 301 caractères (refusé, pas tronqué)', 'REFUSÉ 22001',
    format('SELECT public.admin_bannir(%L, repeat(''m'', 301), 1)', v));
  r := r || public.__sonde_ligne('C6 une durée de 0 jour', 'REFUSÉ 22023',
    format('SELECT public.admin_bannir(%L, ''Essai'', 0)', v));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_ligne('C7 un visiteur appelle la fonction', 'REFUSÉ 42501',
    format('SELECT public.admin_bannir(%L, ''Essai'', 1)', u));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- D. Le bannissement daté prend fin
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_ligne('D0 (préparation) la fin du bannissement passe d''une minute', 'ACCEPTÉ',
    format('UPDATE public.profiles SET banned_until = now() - interval ''1 minute'' WHERE id = %L', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  r := r || public.__sonde_valeur('D1 la date passée, le compte peut de nouveau écrire (avant même la tâche)', 'true',
    'SELECT private.compte_peut_ecrire()::text');
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('D2 la tâche planifiée lève le bannissement échu', 'oui',
    'SELECT CASE WHEN private.lever_les_bannissements_echus() >= 1 THEN ''oui'' ELSE ''non'' END');
  r := r || public.__sonde_valeur('D3 … le profil est remis à zéro, et le journal le dit', 'false NULL 1',
    format('SELECT banned::text || '' '' || coalesce(banned_reason, ''NULL'') || '' '' || (SELECT count(*) FROM public.activity_logs WHERE action = ''user_unbanned'' AND target_id = %L AND metadata->>''reason'' = ''expired'')::text FROM public.profiles WHERE id = %L', u, u));

  ---------------------------------------------------------------------------
  -- E. Sans date de fin, puis débanni
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E1 l''admin bannit sans date de fin', 'ACCEPTÉ',
    format('SELECT public.admin_bannir(%L, ''Harcèlement'', NULL)', u));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('E2 profil sans fin, service d''authentification dans environ 100 ans', 'NULL oui',
    format('SELECT coalesce(p.banned_until::text, ''NULL'') || '' '' || CASE WHEN u.banned_until > now() + interval ''99 years'' THEN ''oui'' ELSE coalesce(u.banned_until::text, ''NULL'') END FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.id = %L', u));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E3 l''admin débannit', 'ACCEPTÉ',
    format('SELECT public.admin_debannir(%L)', u));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('E4 tout est défait (profil et service d''authentification)', 'false NULL NULL NULL',
    format('SELECT p.banned::text || '' '' || coalesce(p.banned_reason, ''NULL'') || '' '' || coalesce(p.banned_until::text, ''NULL'') || '' '' || coalesce(u.banned_until::text, ''NULL'') FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.id = %L', u));

  ---------------------------------------------------------------------------
  -- F. La forme
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('F1 la levée des bannissements échus est planifiée (tous les quarts d''heure)', '1',
    'SELECT count(*)::text FROM cron.job WHERE jobname = ''lever_les_bannissements_echus'' AND schedule = ''*/15 * * * *''');
  r := r || public.__sonde_valeur('F2 la garde des colonnes du bannissement est posée', '1',
    'SELECT count(*)::text FROM pg_trigger WHERE tgname = ''trg_garder_le_bannissement'' AND tgrelid = ''public.profiles''::regclass');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-05, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT la migration : 26 écarts sur 26 gestes (ni les colonnes, ni la garde, ni
--   les fonctions, ni la tâche n'existaient). À noter : A4 = « 3 7 » — le compte
--   avait déjà deux vraies sessions et six jetons de renouvellement, que le
--   bannissement de l'essai à blanc a bien supprimés (bloc annulé, rien d'écrit).
--
-- ESSAI À BLANC (DDL de la migration injecté dans le bloc) : 0 écart sur
--   26 gestes.
--
-- APRÈS application (`bannissement_reel`, version 20261005162527) : 0 écart
--   sur 26 gestes. Advisors : 4 fonctions SECURITY DEFINER pour `anon`
--   (inchangé), 27 pour `authenticated` (+2, la note interne sur les advisors Supabase).
--
-- CE QUE LA SONDE NE PROUVE PAS : que le service d'authentification refuse
--   la connexion et le renouvellement après cette écriture directe. À vérifier
--   après la release avec un compte d'essai (e-mail ET Google).
