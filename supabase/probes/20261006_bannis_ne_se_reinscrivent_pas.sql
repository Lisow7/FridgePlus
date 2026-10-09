-- Sonde de la migration 20261006_bannis_ne_se_reinscrivent_pas.sql : une
-- personne bannie qui supprime son compte ne se réinscrit pas avec la même
-- adresse. Audit du 2026-10-04, lot 3c-3b (note d'Antoine sur la planche).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- AUCUN compte ni profil réel n'est créé, modifié ni effacé : les deux
-- déclencheurs sont rejoués sur des tables TEMPORAIRES munies des vraies
-- fonctions ; un profil réel non banni est seulement LU (jamais affiché).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  v_libre  uuid;
  v_avant  int;
  r        text := '';
BEGIN
  SELECT id INTO v_libre FROM public.profiles WHERE NOT COALESCE(banned, false) LIMIT 1;
  IF v_libre IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un profil non banni';
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

  SELECT count(*) INTO v_avant FROM private.adresses_interdites;
  r := r || E'\nInfo — empreintes déjà gardées : ' || v_avant;

  ---------------------------------------------------------------------------
  -- A. L'empreinte
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('A1 insensible à la casse et aux espaces', 'true',
    $q$SELECT (private.empreinte_adresse(' Sonde@Exemple.TEST ') = private.empreinte_adresse('sonde@exemple.test'))::text$q$);
  r := r || public.__sonde_valeur('A2 un sha256 en hexadécimal', '64',
    $q$SELECT length(private.empreinte_adresse('sonde@exemple.test'))::text$q$);

  ---------------------------------------------------------------------------
  -- B. La décision « garder l'empreinte », avec des valeurs inventées
  ---------------------------------------------------------------------------
  PERFORM private.retenir_l_empreinte('sonde-sansfin@exemple.test', true, NULL);
  PERFORM private.retenir_l_empreinte('sonde-date@exemple.test', true, now() + interval '7 days');
  PERFORM private.retenir_l_empreinte('sonde-echu@exemple.test', true, now() - interval '1 day');
  PERFORM private.retenir_l_empreinte('sonde-libre@exemple.test', false, NULL);
  PERFORM private.retenir_l_empreinte('sonde-inconnu@exemple.test', NULL, NULL);
  PERFORM private.retenir_l_empreinte(NULL, true, NULL);
  r := r || public.__sonde_valeur('B1 de six cas, seuls « banni sans fin » et « banni jusqu''à demain » laissent une empreinte', '2',
    format('SELECT (count(*) - %s)::text FROM private.adresses_interdites', v_avant));
  r := r || public.__sonde_valeur('B2 banni sans fin : gardée sans date', 'sans fin',
    $q$SELECT coalesce(jusqu_au::text, 'sans fin') FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-sansfin@exemple.test')$q$);
  PERFORM private.retenir_l_empreinte('SONDE-DATE@exemple.test ', true, now() + interval '30 days');
  r := r || public.__sonde_valeur('B3 de deux dates, la plus lointaine', 'true',
    $q$SELECT (jusqu_au > now() + interval '29 days')::text FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-date@exemple.test')$q$);
  PERFORM private.retenir_l_empreinte('sonde-date@exemple.test', true, NULL);
  PERFORM private.retenir_l_empreinte('sonde-date@exemple.test', true, now() + interval '1 day');
  r := r || public.__sonde_valeur('B4 « sans fin » l''emporte sur une date', 'sans fin',
    $q$SELECT coalesce(jusqu_au::text, 'sans fin') FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-date@exemple.test')$q$);

  ---------------------------------------------------------------------------
  -- C. Le refus — table temporaire munie de la VRAIE fonction du déclencheur
  ---------------------------------------------------------------------------
  CREATE TEMP TABLE sonde_comptes (id uuid DEFAULT gen_random_uuid(), email text) ON COMMIT DROP;
  CREATE TRIGGER sonde_refus BEFORE INSERT OR UPDATE OF email ON sonde_comptes
    FOR EACH ROW EXECUTE FUNCTION private.refuser_une_adresse_interdite();
  PERFORM private.retenir_l_empreinte('sonde-dan@exemple.test', true, now() + interval '7 days');
  r := r || public.__sonde_ligne('C1 adresse interdite sans fin, écrite autrement', 'REFUSÉ 42501',
    $q$INSERT INTO sonde_comptes (email) VALUES ('Sonde-SansFin@Exemple.test')$q$);
  r := r || public.__sonde_ligne('C2 adresse interdite jusqu''à une date future', 'REFUSÉ 42501',
    $q$INSERT INTO sonde_comptes (email) VALUES ('sonde-dan@exemple.test')$q$);
  r := r || public.__sonde_ligne('C3 interdiction échue', 'ACCEPTÉ',
    $q$INSERT INTO sonde_comptes (email) VALUES ('sonde-echu@exemple.test')$q$);
  r := r || public.__sonde_ligne('C4 adresse libre', 'ACCEPTÉ',
    $q$INSERT INTO sonde_comptes (email) VALUES ('sonde-alice@exemple.test')$q$);
  r := r || public.__sonde_ligne('C5 sans adresse (téléphone, anonyme)', 'ACCEPTÉ',
    $q$INSERT INTO sonde_comptes (email) VALUES (NULL)$q$);
  r := r || public.__sonde_ligne('C6 réécriture sans changer d''adresse (chaque connexion)', 'ACCEPTÉ',
    $q$UPDATE sonde_comptes SET email = email WHERE email = 'sonde-alice@exemple.test'$q$);
  r := r || public.__sonde_ligne('C7 changement vers une adresse interdite', 'REFUSÉ 42501',
    $q$UPDATE sonde_comptes SET email = 'sonde-dan@exemple.test' WHERE email = 'sonde-alice@exemple.test'$q$);

  ---------------------------------------------------------------------------
  -- D. L'effacement — table temporaire munie de la VRAIE fonction du déclencheur
  ---------------------------------------------------------------------------
  CREATE TEMP TABLE sonde_effaces (id uuid, email text) ON COMMIT DROP;
  CREATE TRIGGER sonde_garde BEFORE DELETE ON sonde_effaces
    FOR EACH ROW EXECUTE FUNCTION private.garder_l_adresse_d_un_banni();
  EXECUTE format('INSERT INTO sonde_effaces VALUES (%L, ''sonde-reel@exemple.test''), (gen_random_uuid(), ''sonde-fantome@exemple.test'')', v_libre);
  SELECT count(*) INTO v_avant FROM private.adresses_interdites;
  r := r || public.__sonde_ligne('D1 effacer un compte réel non banni, et un inconnu', 'ACCEPTÉ',
    'DELETE FROM sonde_effaces');
  r := r || public.__sonde_valeur('D2 … ne laisse aucune empreinte, et la ligne part', '0 0',
    format('SELECT ((SELECT count(*) FROM private.adresses_interdites) - %s) || '' '' || (SELECT count(*) FROM sonde_effaces)', v_avant));

  ---------------------------------------------------------------------------
  -- E. La forme
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('E1 trois déclencheurs sur auth.users (le nôtre d''inscription + les deux)', '3',
    $q$SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal$q$);
  r := r || public.__sonde_valeur('E2 avant l''effacement, et avant l''écriture d''une adresse', 'true true',
    $q$SELECT (pg_get_triggerdef(t1.oid) LIKE '%BEFORE DELETE ON auth.users FOR EACH ROW%')::text || ' ' ||
              (pg_get_triggerdef(t2.oid) LIKE '%BEFORE INSERT OR UPDATE OF email ON auth.users FOR EACH ROW%')::text
         FROM pg_trigger t1, pg_trigger t2
        WHERE t1.tgrelid = 'auth.users'::regclass AND t1.tgname = 'garder_l_adresse_d_un_banni'
          AND t2.tgrelid = 'auth.users'::regclass AND t2.tgname = 'refuser_une_adresse_interdite'$q$);
  r := r || public.__sonde_valeur('E3 la garde « adresse inchangée » est dans la fonction', 'true',
    $q$SELECT (prosrc LIKE '%NEW.email IS NOT DISTINCT FROM OLD.email%')::text FROM pg_proc WHERE oid = 'private.refuser_une_adresse_interdite()'::regprocedure$q$);
  r := r || public.__sonde_valeur('E4 aucune des quatre fonctions n''est ouverte à PUBLIC, anon ni authenticated', '0',
    $q$SELECT count(*)::text FROM pg_proc p, unnest(ARRAY['public','anon','authenticated']) AS role(nom)
        WHERE p.pronamespace = 'private'::regnamespace
          AND p.proname IN ('empreinte_adresse','retenir_l_empreinte','garder_l_adresse_d_un_banni','refuser_une_adresse_interdite')
          AND has_function_privilege(role.nom, p.oid, 'EXECUTE')$q$);
  r := r || public.__sonde_valeur('E5 la table des empreintes est fermée à l''API', 'false false',
    $q$SELECT has_table_privilege('anon', 'private.adresses_interdites', 'SELECT,INSERT,UPDATE,DELETE')::text || ' ' ||
              has_table_privilege('authenticated', 'private.adresses_interdites', 'SELECT,INSERT,UPDATE,DELETE')::text$q$);
  r := r || public.__sonde_valeur('E6 les deux fonctions des déclencheurs : SECURITY DEFINER, search_path vide', '2',
    $q$SELECT count(*)::text FROM pg_proc
        WHERE oid IN ('private.garder_l_adresse_d_un_banni()'::regprocedure, 'private.refuser_une_adresse_interdite()'::regprocedure)
          AND prosecdef AND proconfig = ARRAY['search_path=""']$q$);

  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).