-- Sonde de la migration `consultations_sensibles_tracees` : révéler l'e-mail,
-- la dernière connexion et les allergènes d'un compte passe par une fonction
-- qui écrit la trace AVANT de lire, et seulement pour un administrateur.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Comptes : le premier administrateur, et deux comptes ordinaires non
-- supprimés, joués par leur jeton (`request.jwt.claims`). Tout est annulé.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a  uuid;  -- l'administrateur
  u  uuid;  -- le compte consulté
  v  uuid;  -- un autre compte ordinaire
  r  text := '';
  v_avant integer;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO v FROM public.profiles
   WHERE role = 'user' AND deleted_at IS NULL AND id <> u ORDER BY created_at DESC LIMIT 1;
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

  -- [essai à blanc : le DDL de la migration est injecté ici]

  SELECT count(*) INTO v_avant FROM public.activity_logs WHERE action = 'sensitive_data_accessed';

  ---------------------------------------------------------------------------
  -- A. L'administrateur révèle le compte u, avec un motif.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := r || public.__sonde_valeur('A1 il reçoit l''e-mail de u, et une seule ligne', '1/true',
    format($q$SELECT count(*) || '/' || bool_and(x.email = (SELECT email FROM auth.users WHERE id = %L))
              FROM public.admin_reveler_compte(%L, 'Suivi d''un ticket de support — sonde') x$q$, u, u));
  r := r || public.__sonde_valeur('A2 une ligne au journal : à son nom, cible user = u, motif et trois champs', '1/' || a || '/user/Suivi d''un ticket de support — sonde/3',
    format($q$SELECT count(*) || '/' || max(user_id::text) || '/' || max(target_type) || '/' || max(metadata->>'reason') || '/' || max(jsonb_array_length(metadata->'champs'))
              FROM public.activity_logs WHERE action = 'sensitive_data_accessed' AND target_id = %L$q$, u::text));
  r := r || public.__sonde_valeur('A3 à l''heure du serveur', 'true',
    format($q$SELECT bool_and(created_at > now() - interval '1 minute' AND created_at <= now() + interval '1 second')::text
              FROM public.activity_logs WHERE action = 'sensitive_data_accessed' AND target_id = %L$q$, u::text));

  ---------------------------------------------------------------------------
  -- B. Les refus : rien n'est rendu, rien n'est écrit.
  r := r || public.__sonde_ligne('B1 motif vide', 'REFUSÉ 22023',
    format('SELECT * FROM public.admin_reveler_compte(%L, %L)', v, '   '));
  r := r || public.__sonde_ligne('B2 motif de 401 caractères', 'REFUSÉ 22023',
    format('SELECT * FROM public.admin_reveler_compte(%L, repeat(''m'', 401))', v));
  r := r || public.__sonde_ligne('B3 compte inexistant', 'REFUSÉ P0002',
    format('SELECT * FROM public.admin_reveler_compte(%L, ''Enquête de sécurité'')', gen_random_uuid()));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  r := r || public.__sonde_ligne('B4 un compte ordinaire', 'REFUSÉ 42501',
    format('SELECT * FROM public.admin_reveler_compte(%L, ''Curiosité'')', u));
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_ligne('B5 sans compte', 'REFUSÉ 42501',
    format('SELECT * FROM public.admin_reveler_compte(%L, ''Curiosité'')', u));
  r := r || public.__sonde_valeur('B6 aucun de ces refus n''a écrit au journal', (v_avant + 1)::text,
    $q$SELECT count(*)::text FROM public.activity_logs WHERE action = 'sensitive_data_accessed'$q$);

  ---------------------------------------------------------------------------
  -- C. Bornes du journal : le pire motif accepté (400 caractères de 4 octets)
  --    tient dans les 2 048 octets de métadonnées.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r := r || public.__sonde_ligne('C1 motif de 400 caractères de 4 octets', 'ACCEPTÉ',
    format('SELECT * FROM public.admin_reveler_compte(%L, repeat(%L, 400))', v, '😀'));

  ---------------------------------------------------------------------------
  -- D. Atomicité : si le journal refuse la ligne, rien n'est rendu.
  -- PL/pgSQL ne remplace pas une variable dans un ALTER TABLE : EXECUTE.
  EXECUTE format('ALTER TABLE public.activity_logs ADD CONSTRAINT __sonde_refus CHECK (target_id IS DISTINCT FROM %L) NOT VALID', v::text);
  r := r || public.__sonde_ligne('D1 journal refusé → la fonction lève, aucune donnée rendue', 'REFUSÉ 23514',
    format($q$SELECT email FROM public.admin_reveler_compte(%L, 'Enquête de sécurité')$q$, v));
  ALTER TABLE public.activity_logs DROP CONSTRAINT __sonde_refus;

  ---------------------------------------------------------------------------
  -- E. Droits et forme.
  r := r || public.__sonde_valeur('E1 un visiteur ne peut pas l''appeler, un compte connecté si (puis la fonction refuse)', 'false/true',
    $q$SELECT has_function_privilege('anon', 'public.admin_reveler_compte(uuid, text)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.admin_reveler_compte(uuid, text)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('E2 SECURITY DEFINER, search_path vide', 'true/search_path=""',
    $q$SELECT p.prosecdef::text || '/' || array_to_string(p.proconfig, ',') FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'admin_reveler_compte'$q$);

  RAISE EXCEPTION 'SONDE consultations_sensibles_tracees :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).