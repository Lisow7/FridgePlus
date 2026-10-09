-- Sonde de l'inscription sans impasse (migration
-- 20261004_inscription_sans_impasse.sql). Audit du 2026-10-04 : CPT-05, CPT-06,
-- CPT-09.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit — ni les comptes créés dans
-- `auth.users`, ni leurs profils. Le « message d'erreur » est le rapport ; une
-- ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Elle crée des comptes comme le fait le service d'authentification (une ligne
-- dans `auth.users`, ce qui déclenche `handle_new_user`), puis joue, dans la
-- peau de ces comptes, d'un visiteur et de l'admin : l'acceptation des
-- conditions, « ce pseudo est-il libre ? », le choix et le changement de pseudo.
--
-- LIMITE : les comptes sont insérés par le rôle `postgres`, pas par
-- `supabase_auth_admin` (on ne peut pas prendre ce rôle depuis l'éditeur SQL).
-- `handle_new_user` étant SECURITY DEFINER, elle s'exécute de toute façon avec
-- les droits de son propriétaire : la différence ne joue pas ici.
--
-- RÉSULTATS DU 2026-10-04 : voir la fin du fichier.

DO $probe$
DECLARE
  a   uuid;                      -- le compte admin
  u   uuid;                      -- un compte ordinaire, déjà là
  g   uuid;                      -- un compte créé par la sonde, parcours Google
  e   uuid;                      -- un compte créé par la sonde, parcours e-mail
  s   text := substr(md5(random()::text), 1, 5);   -- marque de cette exécution
  libre  text;                   -- un pseudo libre de 11 caractères, pris en A4
  long18 text;                   -- un pseudo libre de 18 caractères, pris en A6
  r   text := '';
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND COALESCE(banned, false) = false AND deleted_at IS NULL
     AND consent_terms_accepted_at IS NULL
   ORDER BY created_at LIMIT 1;
  IF a IS NULL OR u IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin et un compte ordinaire sans date d''acceptation';
  END IF;
  libre  := 'Sonde_' || s;
  long18 := 'Sonde_' || s || '_abcdef';

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
      obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 60);
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
      obtenu := 'ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 60);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  -- Crée un compte comme le service d'authentification, et dit quel profil le
  -- déclencheur lui a donné : d'où vient le pseudo, s'il reste à choisir, si
  -- l'acceptation est datée.
  CREATE FUNCTION public.__sonde_compte(libelle text, attendu text, p_email text, p_meta jsonb) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE
    v_id   uuid := gen_random_uuid();
    saisi  text := nullif(btrim(coalesce(p_meta->>'username', '')), '');
    p      record;
    obtenu text;
  BEGIN
    BEGIN
      INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      VALUES (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, p_meta, '{}'::jsonb, now(), now());
      SELECT * INTO p FROM public.profiles WHERE id = v_id;
      IF NOT FOUND THEN
        obtenu := 'CRÉÉ SANS PROFIL';
      ELSE
        obtenu := 'CRÉÉ, pseudo '
          || CASE
               WHEN p.username = saisi THEN 'saisi'
               WHEN p.username ~ '^chef_[0-9a-f]{8}$' THEN 'd''attente'
               WHEN p.username = split_part(p_email, '@', 1) THEN 'tiré de l''adresse'
               WHEN saisi IS NOT NULL AND left(p.username, length(saisi)) = saisi THEN 'saisi + suffixe subi'
               ELSE 'autre'
             END
          || CASE WHEN p.username_confirmed THEN ' (confirmé)' ELSE ' (à choisir)' END
          || ', acceptation '
          || CASE
               WHEN p.consent_terms_accepted_at = now() AND p.consent_privacy_accepted_at = now() THEN 'datée'
               WHEN p.consent_terms_accepted_at IS NULL AND p.consent_privacy_accepted_at IS NULL THEN 'non datée'
               ELSE 'incohérente'
             END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'ÉCHEC ' || SQLSTATE || ' ' || left(SQLERRM, 60);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  ---------------------------------------------------------------------------
  -- A. Création de comptes (déclencheur `handle_new_user`)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);

  r := r || public.__sonde_compte('A1 Google, adresse de 24 caractères', 'CRÉÉ, pseudo d''attente (à choisir), acceptation non datée',
    'jean-baptiste.dupont1985@sonde.invalid', '{"full_name": "Jean-Baptiste Dupont"}');
  r := r || public.__sonde_compte('A2 Google, adresse de 2 caractères', 'CRÉÉ, pseudo d''attente (à choisir), acceptation non datée',
    'jo@sonde.invalid', '{"full_name": "Jo"}');
  r := r || public.__sonde_compte('A3 Google, adresse ordinaire', 'CRÉÉ, pseudo d''attente (à choisir), acceptation non datée',
    'marie.durand@sonde.invalid', '{"full_name": "Marie Durand"}');
  r := r || public.__sonde_compte('A4 e-mail, pseudo libre, case cochée', 'CRÉÉ, pseudo saisi (confirmé), acceptation datée',
    'a4@sonde.invalid', jsonb_build_object('username', libre, 'lang', 'fr', 'consent_accepted', true));
  r := r || public.__sonde_compte('A5 e-mail, pseudo déjà pris (autre casse)', 'CRÉÉ, pseudo d''attente (à choisir), acceptation datée',
    'a5@sonde.invalid', jsonb_build_object('username', upper(libre), 'lang', 'fr', 'consent_accepted', true));
  r := r || public.__sonde_compte('A6 e-mail, pseudo libre de 18 caractères', 'CRÉÉ, pseudo saisi (confirmé), acceptation datée',
    'a6@sonde.invalid', jsonb_build_object('username', long18, 'lang', 'fr', 'consent_accepted', true));
  r := r || public.__sonde_compte('A7 e-mail, ce pseudo de 18 caractères déjà pris', 'CRÉÉ, pseudo d''attente (à choisir), acceptation datée',
    'a7@sonde.invalid', jsonb_build_object('username', long18, 'lang', 'fr', 'consent_accepted', true));
  r := r || public.__sonde_compte('A8 e-mail, pseudo réservé (Admin_…)', 'CRÉÉ, pseudo d''attente (à choisir)',
    'a8@sonde.invalid', jsonb_build_object('username', 'Admin_' || s, 'consent_accepted', true));
  r := r || public.__sonde_compte('A9 e-mail, pseudo hors règle (<b>Zo</b>)', 'CRÉÉ, pseudo d''attente (à choisir)',
    'a9@sonde.invalid', jsonb_build_object('username', '<b>Zo</b>', 'consent_accepted', true));
  r := r || public.__sonde_compte('A10 e-mail, pseudo libre, case non transmise', 'CRÉÉ, pseudo saisi (confirmé), acceptation non datée',
    'a10@sonde.invalid', jsonb_build_object('username', 'Sonde10_' || s, 'lang', 'fr'));
  r := r || public.__sonde_compte('A11 e-mail, case transmise à « faux »', 'CRÉÉ, pseudo saisi (confirmé), acceptation non datée',
    'a11@sonde.invalid', jsonb_build_object('username', 'Sonde11_' || s, 'consent_accepted', false));

  SELECT id INTO g FROM auth.users WHERE email = 'marie.durand@sonde.invalid';
  SELECT id INTO e FROM auth.users WHERE email = 'a10@sonde.invalid';

  ---------------------------------------------------------------------------
  -- B. La preuve d'acceptation, dans la peau du compte Google `g`
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  r := r || public.__sonde_ligne('B1 antidater son acceptation (2020)', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET consent_terms_accepted_at = ''2020-01-01'', consent_privacy_accepted_at = ''2020-01-01'' WHERE id = %L', g));
  r := r || public.__sonde_ligne('B2 la dater dans dix minutes', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET consent_terms_accepted_at = now() + interval ''10 minutes'' WHERE id = %L', g));
  r := r || public.__sonde_valeur('B3 record_signup_consent() rend l''heure du serveur', 'true',
    'SELECT (public.record_signup_consent() = now())::text');
  r := r || public.__sonde_valeur('B4 les deux dates sont posées', 'true',
    format('SELECT (consent_terms_accepted_at = now() AND consent_privacy_accepted_at = now())::text FROM public.profiles WHERE id = %L', g));
  r := r || public.__sonde_ligne('B5 modifier une date déjà posée', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET consent_terms_accepted_at = now() - interval ''10 seconds'' WHERE id = %L', g));
  r := r || public.__sonde_ligne('B6 effacer une date déjà posée', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET consent_privacy_accepted_at = NULL WHERE id = %L', g));

  -- Une date ancienne (posée ici par le serveur) n'est pas écrasée par un
  -- second appel : `now()` ne bouge pas dans une transaction, il faut donc une
  -- date différente pour le voir.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET consent_terms_accepted_at = now() - interval '3 days', consent_privacy_accepted_at = now() - interval '3 days' WHERE id = g;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('B7 second appel : la première date est gardée', 'true',
    'SELECT (public.record_signup_consent() = now() - interval ''3 days'')::text');

  -- Un compte ancien, sans date : il peut la poser lui-même, à l'heure du serveur seulement.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B8 compte ancien : dater son acceptation d''il y a deux minutes', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET consent_terms_accepted_at = now() - interval ''2 minutes'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('B9 compte ancien : la dater à l''instant', 'ACCEPTÉ',
    format('UPDATE public.profiles SET consent_terms_accepted_at = now(), consent_privacy_accepted_at = now() WHERE id = %L', u));

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_valeur('B10 visiteur : record_signup_consent()', 'ERREUR 42501',
    'SELECT public.record_signup_consent()::text');

  ---------------------------------------------------------------------------
  -- C. « Ce pseudo est-il libre ? » — visiteur, puis compte, puis admin
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('C1 visiteur : pseudo libre', 'true', format('SELECT public.username_available(%L)::text', 'Libre_' || s));
  r := r || public.__sonde_valeur('C2 visiteur : pseudo pris, autre casse', 'false', format('SELECT public.username_available(%L)::text', lower(libre)));
  r := r || public.__sonde_valeur('C3 visiteur : pseudo libre dont le « _ » couvrirait un pseudo pris', 'true', format('SELECT public.username_available(%L)::text', '_onde_' || s));
  r := r || public.__sonde_valeur('C4 visiteur : Admin', 'false', 'SELECT public.username_available(''Admin'')::text');
  r := r || public.__sonde_valeur('C5 visiteur : FridgePlus_Team', 'false', 'SELECT public.username_available(''FridgePlus_Team'')::text');
  r := r || public.__sonde_valeur('C6 visiteur : support', 'false', 'SELECT public.username_available(''support'')::text');
  r := r || public.__sonde_valeur('C7 visiteur : Moderateur_42', 'false', 'SELECT public.username_available(''Moderateur_42'')::text');
  r := r || public.__sonde_valeur('C8 visiteur : Supporter_OM (pas réservé)', 'true', 'SELECT public.username_available(''Supporter_OM'')::text');
  r := r || public.__sonde_valeur('C9 visiteur : Badminton (pas réservé)', 'true', 'SELECT public.username_available(''Badminton'')::text');
  r := r || public.__sonde_valeur('C10 visiteur : FridgeSteamer (pas réservé)', 'true', 'SELECT public.username_available(''FridgeSteamer'')::text');
  r := r || public.__sonde_valeur('C11 visiteur : 2 caractères', 'false', 'SELECT public.username_available(''ab'')::text');
  r := r || public.__sonde_valeur('C12 visiteur : 21 caractères', 'false', 'SELECT public.username_available(''abcdefghijklmnopqrstu'')::text');
  r := r || public.__sonde_valeur('C13 visiteur : avec une espace', 'false', 'SELECT public.username_available(''a b c'')::text');
  r := r || public.__sonde_valeur('C14 visiteur : <b>x</b>', 'false', 'SELECT public.username_available(''<b>x</b>'')::text');
  r := r || public.__sonde_valeur('C15 visiteur : rien', 'false', 'SELECT public.username_available(NULL)::text');
  r := r || public.__sonde_valeur('C16 visiteur : lire la table profiles reste impossible', '0', 'SELECT count(*)::text FROM public.profiles');

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('C17 compte : son propre pseudo', 'true', format('SELECT public.username_available(%L)::text', 'Sonde10_' || s));
  r := r || public.__sonde_valeur('C18 compte : le pseudo d''un autre', 'false', format('SELECT public.username_available(%L)::text', libre));

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('C19 admin : un pseudo réservé et libre', 'true', format('SELECT public.username_available(%L)::text', 'Admin_' || s));
  r := r || public.__sonde_valeur('C20 admin : un pseudo pris', 'false', format('SELECT public.username_available(%L)::text', libre));

  ---------------------------------------------------------------------------
  -- D. Choisir et changer son pseudo, dans la peau du compte Google `g`
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  r := r || public.__sonde_ligne('D1 écran du pseudo : pseudo libre et valide', 'ACCEPTÉ',
    format('UPDATE public.profiles SET username = %L, username_confirmed = true WHERE id = %L', 'Marie_' || s, g));
  r := r || public.__sonde_ligne('D2 ne changer que la casse de son pseudo', 'ACCEPTÉ',
    format('UPDATE public.profiles SET username = %L WHERE id = %L', 'MARIE_' || s, g));
  r := r || public.__sonde_ligne('D3 prendre un pseudo déjà pris (autre casse)', 'REFUSÉ 23505',
    format('UPDATE public.profiles SET username = %L WHERE id = %L', lower(libre), g));
  r := r || public.__sonde_ligne('D4 prendre un pseudo réservé', 'REFUSÉ 23514 reserved_username',
    format('UPDATE public.profiles SET username = %L WHERE id = %L', 'Admin_' || s, g));
  r := r || public.__sonde_ligne('D5 prendre un pseudo hors règle (<b>Zo</b>)', 'REFUSÉ 23514 invalid_username',
    format('UPDATE public.profiles SET username = %L WHERE id = %L', '<b>Zo</b>', g));
  r := r || public.__sonde_ligne('D6 prendre un pseudo de 2 caractères', 'REFUSÉ 23514',
    format('UPDATE public.profiles SET username = %L WHERE id = %L', 'ab', g));

  -- Un pseudo ancien hors règle (posé ici par le serveur) ne bloque rien tant
  -- que la personne n'y touche pas.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET username = 'Zoé d''Avant' WHERE id = g;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('D7 pseudo ancien hors règle : modifier sa bio', 'ACCEPTÉ',
    format('UPDATE public.profiles SET community_bio = ''Bio de la sonde.'' WHERE id = %L', g));
  r := r || public.__sonde_ligne('D8 pseudo ancien hors règle : le réécrire tel quel', 'ACCEPTÉ',
    format('UPDATE public.profiles SET username = username WHERE id = %L', g));

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('D9 admin : renommer un compte hors règle', 'ACCEPTÉ',
    format('UPDATE public.profiles SET username = ''Compte renommé'' WHERE id = %L', g));

  ---------------------------------------------------------------------------
  -- E. Le reste du garde des colonnes privilégiées n'a pas bougé
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('E1 se donner le rôle admin', 'REFUSÉ 42501', format('UPDATE public.profiles SET role = ''admin'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('E2 se marquer banni', 'REFUSÉ 42501', format('UPDATE public.profiles SET banned = true WHERE id = %L', u));
  r := r || public.__sonde_ligne('E3 s''offrir le Premium', 'REFUSÉ 42501', format('UPDATE public.profiles SET subscription_status = ''active'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('E4 lever sa sourdine', 'REFUSÉ 42501', format('UPDATE public.profiles SET community_muted_until = now() - interval ''1 day'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('E5 annuler sa propre suppression', 'ACCEPTÉ', format('UPDATE public.profiles SET deleted_at = NULL, restore_token = NULL WHERE id = %L', u));
  r := r || public.__sonde_ligne('E6 horodater sa connexion', 'ACCEPTÉ', format('UPDATE public.profiles SET last_login_at = now() WHERE id = %L', u));

  ---------------------------------------------------------------------------
  -- F. Recréer son profil (cas d'école : il existe toujours) ne permet pas
  --    davantage d'inventer une preuve ni de prendre un pseudo réservé
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  DELETE FROM public.profiles WHERE id = e;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F1 profil recréé avec une acceptation de 2020', 'REFUSÉ 42501',
    format('INSERT INTO public.profiles (id, username, avatar_id, consent_terms_accepted_at) VALUES (%L, %L, ''tomato'', ''2020-01-01'')', e, 'Sonde10_' || s));
  -- (Si une ligne a été acceptée à tort, elle est retirée pour que la suivante se joue.)
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  DELETE FROM public.profiles WHERE id = e;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F2 profil recréé avec un pseudo réservé', 'REFUSÉ 23514 reserved_username',
    format('INSERT INTO public.profiles (id, username, avatar_id) VALUES (%L, %L, ''tomato'')', e, 'Support'));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  DELETE FROM public.profiles WHERE id = e;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F3 profil recréé, pseudo valide, sans date', 'ACCEPTÉ',
    format('INSERT INTO public.profiles (id, username, avatar_id) VALUES (%L, %L, ''tomato'')', e, 'Sonde10_' || s));

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS DU 2026-10-04 (59 lignes à chaque fois, rien d'écrit)
--
-- 1. AVANT toute migration — 38 écarts, dont les défauts que l'audit annonçait :
--      A1, A2  création du compte en ÉCHEC (23514) pour une adresse de 24 ou de
--              2 caractères ;
--      A3      pseudo tiré de l'adresse e-mail ;
--      A5      suffixe ajouté sans le dire, pseudo gardé « confirmé » ;
--      A7      création en ÉCHEC quand un pseudo de 18 caractères est déjà pris ;
--      A4, A6  acceptation jamais datée ;
--      A8, A9  « Admin_… » et « <b>Zo</b> » acceptés tels quels ;
--      F1      une acceptation datée de 2020 acceptée à la recréation du profil.
--    (Les lignes B3, B7, B10 et C1 à C20 s'écartent parce que les deux
--    fonctions n'existaient pas encore.)
--
-- 2. Essai à blanc des DEUX migrations (leur DDL exécuté dans ce bloc, donc
--    annulé avec lui) : 0 écart.
--
-- 3. Essai à blanc de la PREMIÈRE seule, puis de nouveau APRÈS son application
--    (`20261004213850 inscription_sans_impasse`) : 3 écarts, les mêmes les deux
--    fois — D4, D5 et F2. Ce sont exactement les refus que pose la seconde
--    migration (`20261005_regle_du_pseudo_tenue_par_la_base.sql`), pas encore
--    appliquée : elle attend que l'application qui explique ces refus soit en
--    production. Après elle, la sonde doit rendre 0 écart.
