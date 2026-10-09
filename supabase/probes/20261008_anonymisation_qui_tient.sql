-- Sonde de la migration 20261008_anonymisation_qui_tient.sql : l'anonymisation
-- des comptes supprimés tient au deuxième compte, vide ce qui désigne la
-- personne, et `anonymize_user` refuse sans appelant (audit BDD-06).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Cinq comptes fictifs en `.invalid` (domaine réservé) ; tout est annulé par le
-- RAISE final : aucun vrai compte n'est créé, modifié ni anonymisé.
--   b1, b2, b3 — supprimés il y a 40 jours, avec bio, pays, allergènes et leur
--                accord, budgets → anonymisés TOUS LES TROIS (l'ancien code
--                échouait au deuxième)
--   b4         — supprimé il y a 5 jours → pas encore
--   b5         — actif ; sert à l'appel sans appelant (refusé) puis « sur
--                soi-même » (accepté)
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  v_n integer;
  b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); b3 uuid := gen_random_uuid();
  b4 uuid := gen_random_uuid(); b5 uuid := gen_random_uuid();
BEGIN
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

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) VALUES
    (b1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-b1@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days'),
    (b2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-b2@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days'),
    (b3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-b3@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days'),
    (b4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-b4@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days'),
    (b5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-b5@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days');
  UPDATE public.profiles
     SET community_bio = 'bio de sonde', country_code = 'FR', allergen_prefs = '{gluten}', allergen_consent_at = now(),
         monthly_budget = 120, per_trip_budget = 40
   WHERE id IN (b1, b2, b3, b4, b5);
  UPDATE public.profiles SET deleted_at = now() - interval '40 days' WHERE id IN (b1, b2, b3);
  UPDATE public.profiles SET deleted_at = now() - interval '5 days' WHERE id = b4;

  -- A. La tâche nocturne : trois comptes d'un coup, chacun son pseudo.
  v_n := private.anonymiser_les_comptes_supprimes();
  r := r || E'\nA0 comptes anonymisés par la tâche — attendu 3 : ' || v_n || CASE WHEN v_n = 3 THEN '' ELSE ' ⚠' END;
  r := r || public.__sonde_valeur('A1 chacun son pseudo « suppr-… », tous différents', '3/3',
    format($q$SELECT count(*) FILTER (WHERE username ~ '^suppr-[0-9a-f]{14}$') || '/' || count(DISTINCT username) FROM public.profiles WHERE id IN (%L, %L, %L)$q$, b1, b2, b3));
  r := r || public.__sonde_valeur('A2 bio, pays, allergènes et leur accord, budgets : vidés', '3',
    format($q$SELECT count(*)::text FROM public.profiles WHERE id IN (%L, %L, %L) AND community_bio IS NULL AND country_code IS NULL
             AND allergen_prefs = '{}' AND allergen_consent_at IS NULL AND monthly_budget IS NULL AND per_trip_budget IS NULL AND avatar_id = 'chef-1'$q$, b1, b2, b3));
  r := r || public.__sonde_valeur('A3 supprimé il y a 5 jours : pas encore', 'false/bio de sonde',
    format($q$SELECT (username ~ '^suppr-')::text || '/' || community_bio FROM public.profiles WHERE id = %L$q$, b4));
  v_n := private.anonymiser_les_comptes_supprimes();
  r := r || E'\nA4 deuxième passage : rien à refaire — attendu 0 : ' || v_n || CASE WHEN v_n = 0 THEN '' ELSE ' ⚠' END;
  r := r || public.__sonde_valeur('A5 une ligne au journal par compte, marquée « planifiée »', '3',
    format($q$SELECT count(*)::text FROM public.activity_logs WHERE action = 'account_anonymized' AND target_id IN (%L, %L, %L) AND metadata->>'scheduled' = 'true'$q$, b1::text, b2::text, b3::text));

  -- B. `anonymize_user` : refus sans appelant, accord « sur soi-même ».
  BEGIN
    PERFORM public.anonymize_user(b5);
    r := r || E'\nB1 sans appelant : refusé — attendu refus : ACCEPTÉ ⚠';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB1 sans appelant : refusé — attendu refus : refus (' || SQLSTATE || ' ' || left(SQLERRM, 40) || ')';
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b5::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.anonymize_user(b5);
    r := r || public.__sonde_valeur('B2 sur soi-même : accepté, pseudo « suppr-… »', 'true',
      format($q$SELECT (username ~ '^suppr-[0-9a-f]{14}$')::text FROM public.profiles WHERE id = %L$q$, b5));
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nB2 sur soi-même : accepté — ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 60) || ' ⚠';
  END;
  PERFORM set_config('request.jwt.claims', '', true);

  -- C. Droits, tâche, vrais comptes.
  r := r || public.__sonde_valeur('C1 fonctions privées : ni visiteur ni compte', 'false/false/false/false',
    $q$SELECT has_function_privilege('anon', 'private.anonymiser_le_compte(uuid, uuid)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'private.anonymiser_le_compte(uuid, uuid)', 'EXECUTE')::text || '/' ||
              has_function_privilege('anon', 'private.anonymiser_les_comptes_supprimes()', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'private.anonymiser_les_comptes_supprimes()', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('C2 anonymize_user : un compte peut l''appeler, un visiteur non (inchangé)', 'true/false',
    $q$SELECT has_function_privilege('authenticated', 'public.anonymize_user(uuid)', 'EXECUTE')::text || '/' || has_function_privilege('anon', 'public.anonymize_user(uuid)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('C3 la tâche nocturne appelle la fonction privée, à 3 h 30', '30 3 * * *|SELECT private.anonymiser_les_comptes_supprimes()',
    $q$SELECT schedule || '|' || command FROM cron.job WHERE jobname = 'anonymize_soft_deleted_profiles'$q$);
  r := r || public.__sonde_valeur('C4 aucun vrai profil anonymisé', '0',
    $q$SELECT count(*)::text FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.username ~ '^suppr-' AND u.email NOT LIKE '%@exemple.invalid'$q$);

  RAISE EXCEPTION 'SONDE anonymisation_qui_tient :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).