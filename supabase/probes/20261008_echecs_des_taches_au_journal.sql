-- Sonde de la migration 20261008_echecs_des_taches_au_journal.sql : les deux
-- tâches nocturnes sur les comptes écrivent leurs échecs au journal, et
-- continuent avec les comptes suivants.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Comptes fictifs en `.invalid` (domaine réservé), tout annulé :
--   f1 — supprimé il y a 40 jours, mais son futur pseudo est déjà pris par f3 :
--        l'anonymisation échoue → ligne `account_anonymization_failed`
--   f2 — supprimé il y a 40 jours → anonymisé quand même (la tâche continue)
--   e1 — jamais confirmé, jamais connecté, 60 jours, mais il a « accordé » un
--        accès spécial (clé RESTRICT) : gardé → ligne `unconfirmed_account_kept`
--   e3 — jamais confirmé, jamais connecté, 60 jours, rien → effacé quand même
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  v_n integer;
  v_reels integer;
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid();
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid();
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

  SELECT count(*) INTO v_reels FROM auth.users WHERE email NOT LIKE '%@exemple.invalid';

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at, last_sign_in_at) VALUES
    (f1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-f1@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days', now() - interval '100 days'),
    (f2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-f2@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days', now() - interval '100 days'),
    (f3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-f3@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '200 days', now(), now() - interval '200 days', now() - interval '100 days'),
    (e1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-e1@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), NULL, NULL),
    (e2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-e2@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), now() - interval '60 days', now() - interval '59 days'),
    (e3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-e3@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), NULL, NULL);
  UPDATE public.profiles SET deleted_at = now() - interval '40 days' WHERE id IN (f1, f2);
  UPDATE public.profiles SET username = 'suppr-' || left(replace(f1::text, '-', ''), 14) WHERE id = f3;
  INSERT INTO public.special_access (user_id, role, granted_by) VALUES (e2, 'tester', e1);

  -- A. Anonymisation : f1 échoue (pseudo déjà pris), f2 passe, le journal le dit.
  v_n := private.anonymiser_les_comptes_supprimes();
  r := r || E'\nA0 comptes anonymisés — attendu 1 : ' || v_n || CASE WHEN v_n = 1 THEN '' ELSE ' ⚠' END;
  r := r || public.__sonde_valeur('A1 f2 anonymisé malgré l''échec de f1', 'true',
    format($q$SELECT (username ~ '^suppr-[0-9a-f]{14}$')::text FROM public.profiles WHERE id = %L$q$, f2));
  r := r || public.__sonde_valeur('A2 l''échec de f1 est au journal, avec son code', '1/23505',
    format($q$SELECT count(*) || '/' || max(metadata->>'sqlstate') FROM public.activity_logs WHERE action = 'account_anonymization_failed' AND target_id = %L$q$, f1::text));

  -- B. Comptes jamais confirmés : e1 gardé (clé RESTRICT), e3 effacé, le journal le dit.
  v_n := private.effacer_les_comptes_jamais_confirmes();
  r := r || E'\nB0 comptes effacés — attendu 1 : ' || v_n || CASE WHEN v_n = 1 THEN '' ELSE ' ⚠' END;
  r := r || public.__sonde_valeur('B1 e1 gardé, e3 effacé', '1/0',
    format($q$SELECT (SELECT count(*) FROM auth.users WHERE id = %L) || '/' || (SELECT count(*) FROM auth.users WHERE id = %L)$q$, e1, e3));
  r := r || public.__sonde_valeur('B2 la garde de e1 est au journal', '1',
    format($q$SELECT count(*)::text FROM public.activity_logs WHERE action = 'unconfirmed_account_kept' AND target_id = %L AND metadata ? 'sqlstate'$q$, e1::text));

  -- C. Droits et vrais comptes.
  r := r || public.__sonde_valeur('C1 ni visiteur ni compte ne peuvent appeler les tâches', 'false/false/false/false',
    $q$SELECT has_function_privilege('anon', 'private.anonymiser_les_comptes_supprimes()', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'private.anonymiser_les_comptes_supprimes()', 'EXECUTE')::text || '/' ||
              has_function_privilege('anon', 'private.effacer_les_comptes_jamais_confirmes()', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'private.effacer_les_comptes_jamais_confirmes()', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('C2 aucun vrai compte touché', v_reels::text,
    $q$SELECT count(*)::text FROM auth.users WHERE email NOT LIKE '%@exemple.invalid'$q$);

  RAISE EXCEPTION 'SONDE echecs_des_taches_au_journal :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).