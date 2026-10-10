-- Sonde de la migration 20261010014513_index_pseudo_en_double.sql : un seul index
-- UNIQUE sur lower(username), celui que le dépôt crée.
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

  r := r || public.__sonde_valeur('A1 index sans fichier (profiles_username_lower_idx) retiré', '0',
    $q$SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_username_lower_idx'$q$);
  r := r || public.__sonde_valeur('A2 index du dépôt (profiles_username_unique_lower) présent et UNIQUE', 'true',
    $q$SELECT coalesce((SELECT i.indisunique FROM pg_index i WHERE i.indexrelid = 'public.profiles_username_unique_lower'::regclass), false)::text$q$);
  r := r || public.__sonde_valeur('A3 un seul index UNIQUE sur lower(username)', '1',
    $q$SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles'
         AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%lower(username)%'$q$);

  DROP FUNCTION public.__sonde_valeur(text, text, text);
  RAISE EXCEPTION 'RAPPORT DE SONDE (rien n''est écrit) :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).