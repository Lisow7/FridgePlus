-- Sonde de la migration 20261008_bascules_au_journal.sql : basculer une
-- fonctionnalité (`feature_flags.enabled`) laisse une ligne au journal
-- d'activité, écrite par la base.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Le drapeau basculé est `scan_barcode` (prévu, lu par aucun code) ; un compte
-- fictif en `.invalid` joue l'administrateur (sa ligne au journal doit porter
-- son identifiant) ; tout est annulé à la fin.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  v_etat boolean;
  v_avant integer;
  admin_fictif uuid := gen_random_uuid();
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

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
  VALUES (admin_fictif, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sonde-admin@exemple.invalid', '{}'::jsonb, '{}'::jsonb, now(), now(), now());
  SELECT enabled INTO v_etat FROM public.feature_flags WHERE key = 'scan_barcode';
  SELECT count(*) INTO v_avant FROM public.activity_logs WHERE action = 'feature_flag_toggled';

  -- A. Un administrateur bascule le drapeau : une ligne, à son nom, avec le nouvel état.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_fictif, 'role', 'authenticated')::text, true);
  UPDATE public.feature_flags SET enabled = NOT v_etat WHERE key = 'scan_barcode';
  r := r || public.__sonde_valeur('A1 la bascule est au journal, à son nom, avec le nouvel état', '1/' || admin_fictif || '/' || (NOT v_etat),
    format($q$SELECT count(*) || '/' || max(user_id::text) || '/' || max(metadata->>'enabled') FROM public.activity_logs WHERE action = 'feature_flag_toggled' AND target_id = 'scan_barcode' AND target_type = 'feature_flag' AND user_id = %L$q$, admin_fictif));

  -- B. Ce qui n'est pas une bascule n'écrit rien.
  UPDATE public.feature_flags SET description = description WHERE key = 'scan_barcode';
  UPDATE public.feature_flags SET enabled = enabled WHERE key = 'scan_barcode';
  r := r || public.__sonde_valeur('B1 ni une autre colonne ni le même état n''écrivent', (v_avant + 1)::text,
    $q$SELECT count(*)::text FROM public.activity_logs WHERE action = 'feature_flag_toggled'$q$);

  -- C. Sans compte (éditeur SQL, tâche) : la ligne est écrite quand même, sans nom.
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.feature_flags SET enabled = v_etat WHERE key = 'scan_barcode';
  r := r || public.__sonde_valeur('C1 sans compte, la bascule est écrite, sans nom', '1/' || v_etat,
    $q$SELECT count(*) || '/' || max(metadata->>'enabled') FROM public.activity_logs WHERE action = 'feature_flag_toggled' AND target_id = 'scan_barcode' AND user_id IS NULL$q$);

  -- D. Droits et forme.
  r := r || public.__sonde_valeur('D1 ni visiteur ni compte ne peuvent appeler la fonction', 'false/false',
    $q$SELECT has_function_privilege('anon', 'private.journaliser_la_bascule()', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'private.journaliser_la_bascule()', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('D2 le déclencheur suit la colonne enabled, après la mise à jour', 'true',
    $q$SELECT (pg_get_triggerdef(oid) LIKE '%AFTER UPDATE OF enabled ON public.feature_flags%')::text FROM pg_trigger WHERE tgname = 'trg_journaliser_la_bascule'$q$);

  RAISE EXCEPTION 'SONDE bascules_au_journal :%', r;
END
$probe$;

-- RÉSULTATS
--
-- Avant (base du 2026-10-08, bloc annulé) : 5 écarts sur 5 — aucune bascule
-- n'était écrite (A1, B1, C1), ni fonction ni déclencheur (D1, D2).
--
-- Essai à blanc (DDL injecté à la marque), le 2026-10-08 vers 3 h 35 : 5 sur 5.
--
-- Après application (migration `bascules_au_journal`, version
-- 20261008013740), sonde seule : 5 lignes sur 5 conformes —
--   A1 la bascule est au journal, à son nom, avec le nouvel état : 1/<compte>/true
--   B1 ni une autre colonne ni le même état n'écrivent : 1
--   C1 sans compte, la bascule est écrite, sans nom : 1/false
--   D1 ni visiteur ni compte ne peuvent appeler la fonction : false/false
--   D2 le déclencheur suit la colonne enabled, après la mise à jour : true
-- Vérifié ensuite : 0 compte de sonde, 8 comptes réels, 0 ligne de bascule,
-- `scan_barcode` toujours désactivé.
