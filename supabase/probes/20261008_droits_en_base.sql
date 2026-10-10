-- Sonde de la migration 20261010014510_droits_en_base.sql : un visiteur n'exécute
-- plus admin_delete_notification_batch ni ne lit feature_flags.updated_by ou
-- ai_cache ; ce qui sert reste permis (l'admin, la lecture des bascules, le
-- serveur).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
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

  r := r || public.__sonde_valeur('A1 admin_delete_notification_batch : visiteur / PUBLIC', 'false/false',
    $q$SELECT has_function_privilege('anon', 'public.admin_delete_notification_batch(uuid)', 'EXECUTE')::text || '/' ||
              coalesce((SELECT bool_or(a.grantee = 0) FROM pg_proc p, aclexplode(p.proacl) a
                        WHERE p.oid = 'public.admin_delete_notification_batch(uuid)'::regprocedure AND a.privilege_type = 'EXECUTE'), false)::text$q$);
  r := r || public.__sonde_valeur('A2 admin_delete_notification_batch : compte / serveur gardent le droit', 'true/true',
    $q$SELECT has_function_privilege('authenticated', 'public.admin_delete_notification_batch(uuid)', 'EXECUTE')::text || '/' ||
              has_function_privilege('service_role', 'public.admin_delete_notification_batch(uuid)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('B1 feature_flags.updated_by : visiteur / compte', 'false/false',
    $q$SELECT has_column_privilege('anon', 'public.feature_flags', 'updated_by', 'SELECT')::text || '/' ||
              has_column_privilege('authenticated', 'public.feature_flags', 'updated_by', 'SELECT')::text$q$);
  r := r || public.__sonde_valeur('B2 les bascules restent lisibles (key, enabled, label, description, updated_at)', 'true',
    $q$SELECT (has_column_privilege('anon', 'public.feature_flags', 'key', 'SELECT')
           AND has_column_privilege('anon', 'public.feature_flags', 'enabled', 'SELECT')
           AND has_column_privilege('anon', 'public.feature_flags', 'label', 'SELECT')
           AND has_column_privilege('anon', 'public.feature_flags', 'description', 'SELECT')
           AND has_column_privilege('anon', 'public.feature_flags', 'updated_at', 'SELECT')
           AND has_column_privilege('authenticated', 'public.feature_flags', 'key', 'SELECT'))::text$q$);
  r := r || public.__sonde_valeur('B3 l''admin écrit toujours (UPDATE de la table)', 'true',
    $q$SELECT has_table_privilege('authenticated', 'public.feature_flags', 'UPDATE')::text$q$);
  r := r || public.__sonde_valeur('C1 ai_cache : visiteur / compte', 'false/false',
    $q$SELECT has_table_privilege('anon', 'public.ai_cache', 'SELECT')::text || '/' ||
              has_table_privilege('authenticated', 'public.ai_cache', 'SELECT')::text$q$);
  r := r || public.__sonde_valeur('C2 ai_cache : le serveur la lit toujours', 'true',
    $q$SELECT has_table_privilege('service_role', 'public.ai_cache', 'SELECT')::text$q$);

  DROP FUNCTION public.__sonde_valeur(text, text, text);
  RAISE EXCEPTION 'RAPPORT DE SONDE (rien n''est écrit) :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).