-- Sonde de la migration 20261008_comptes_jamais_confirmes.sql : les comptes
-- jamais confirmés s'effacent au bout de 30 jours (décision du
-- 2026-10-07 — « non_confirmes = 30_jours »).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Les six comptes de la sonde portent des adresses en `.invalid` (domaine
-- réservé, jamais attribué). Tout est annulé par le RAISE final : aucun vrai
-- compte n'est créé, modifié ni effacé.
--
--   a1 — non confirmé, jamais connecté, créé il y a 31 jours  → effacé
--   a2 — non confirmé, jamais connecté, créé il y a 10 jours  → gardé
--   a3 — CONFIRMÉ, jamais connecté, créé il y a 60 jours      → gardé
--   a4 — non confirmé, connecté une fois, 60 jours            → gardé
--   a5 — non confirmé, jamais connecté, 60 jours, un aliment  → gardé
--   a6 — non confirmé, jamais connecté, 60 jours, une trace   → effacé, la trace
--        reste sans lien (SET NULL)
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  v_effaces integer;
  v_reels_avant integer;
  a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid();
  a4 uuid := gen_random_uuid(); a5 uuid := gen_random_uuid(); a6 uuid := gen_random_uuid();
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

  SELECT count(*) INTO v_reels_avant FROM auth.users WHERE email NOT LIKE '%@exemple.invalid';

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at, last_sign_in_at) VALUES
    (a1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a1@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '31 days', now(), NULL, NULL),
    (a2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a2@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '10 days', now(), NULL, NULL),
    (a3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a3@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), now() - interval '59 days', NULL),
    (a4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a4@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), NULL, now() - interval '59 days'),
    (a5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a5@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), NULL, NULL),
    (a6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-a6@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now() - interval '60 days', now(), NULL, NULL);
  INSERT INTO public.user_stock (user_id, ingredient_id) VALUES (a5, 'fr-beurre-doux');
  INSERT INTO public.activity_logs (user_id, action, target_type, target_id) VALUES (a6, 'sonde_trace', 'sonde', a6::text);

  r := r || public.__sonde_valeur('0 les six comptes de la sonde ont leur profil', '6',
    format($q$SELECT count(*)::text FROM public.profiles WHERE id IN (%L, %L, %L, %L, %L, %L)$q$, a1, a2, a3, a4, a5, a6));

  v_effaces := private.effacer_les_comptes_jamais_confirmes();
  r := r || E'\nA0 comptes effacés par la fonction — attendu 2 : ' || v_effaces || CASE WHEN v_effaces = 2 THEN '' ELSE ' ⚠' END;

  r := r || public.__sonde_valeur('A1 non confirmé, jamais connecté, 31 jours : effacé (compte et profil)', '0',
    format($q$SELECT (SELECT count(*) FROM auth.users WHERE id = %L) + (SELECT count(*) FROM public.profiles WHERE id = %L)$q$, a1, a1));
  r := r || public.__sonde_valeur('A2 seulement 10 jours : gardé', '1', format($q$SELECT count(*)::text FROM auth.users WHERE id = %L$q$, a2));
  r := r || public.__sonde_valeur('A3 confirmé : gardé', '1', format($q$SELECT count(*)::text FROM auth.users WHERE id = %L$q$, a3));
  r := r || public.__sonde_valeur('A4 connecté une fois : gardé', '1', format($q$SELECT count(*)::text FROM auth.users WHERE id = %L$q$, a4));
  r := r || public.__sonde_valeur('A5 un aliment dans son frigo : gardé, aliment compris', '1/1',
    format($q$SELECT (SELECT count(*) FROM auth.users WHERE id = %L) || '/' || (SELECT count(*) FROM public.user_stock WHERE user_id = %L)$q$, a5, a5));
  r := r || public.__sonde_valeur('A6 une simple trace : effacé, la trace reste sans lien', '0/1',
    format($q$SELECT (SELECT count(*) FROM auth.users WHERE id = %L) || '/' || (SELECT count(*) FROM public.activity_logs WHERE target_id = %L AND user_id IS NULL)$q$, a6, a6::text));

  r := r || public.__sonde_valeur('B1 aucun vrai compte touché', v_reels_avant::text,
    $q$SELECT count(*)::text FROM auth.users WHERE email NOT LIKE '%@exemple.invalid'$q$);
  r := r || public.__sonde_valeur('B2 la tâche quotidienne existe, à 4 h 30 UTC', '30 4 * * *',
    $q$SELECT schedule FROM cron.job WHERE jobname = 'effacer_comptes_jamais_confirmes'$q$);
  r := r || public.__sonde_valeur('B3 ni un visiteur ni un compte ne peuvent l''appeler', 'false/false',
    $q$SELECT has_function_privilege('anon', 'private.effacer_les_comptes_jamais_confirmes()', 'EXECUTE')::text || '/' || has_function_privilege('authenticated', 'private.effacer_les_comptes_jamais_confirmes()', 'EXECUTE')::text$q$);

  RAISE EXCEPTION 'SONDE comptes_jamais_confirmes :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).