-- Sonde de la migration 20261008_acces_special_sans_fonctions_mortes.sql : les
-- deux fonctions d'accès spécial sans appelant ne s'exécutent plus depuis le
-- navigateur ; celles qui servent, si.
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

  r := r || public.__sonde_valeur('A1 grant_comped_access : ni visiteur ni compte', 'false/false',
    $q$SELECT has_function_privilege('anon', 'public.grant_comped_access(uuid, text)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.grant_comped_access(uuid, text)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('A2 clear_special_access_note : ni visiteur ni compte', 'false/false',
    $q$SELECT has_function_privilege('anon', 'public.clear_special_access_note(uuid)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.clear_special_access_note(uuid)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('B1 le serveur les garde (service_role)', 'true/true',
    $q$SELECT has_function_privilege('service_role', 'public.grant_comped_access(uuid, text)', 'EXECUTE')::text || '/' ||
              has_function_privilege('service_role', 'public.clear_special_access_note(uuid)', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('C1 celles qui servent restent appelables par un compte (accorder, révoquer)', 'true/true',
    $q$SELECT has_function_privilege('authenticated', 'public.grant_special_access(uuid, text, text)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.revoke_special_access(uuid)', 'EXECUTE')::text$q$);

  RAISE EXCEPTION 'SONDE acces_special_sans_fonctions_mortes :%', r;
END
$probe$;

-- RÉSULTATS
--
-- Avant (base du 2026-10-08) : A1 ⚠ et A2 ⚠ — tout compte pouvait exécuter
-- les deux fonctions (false/true).
--
-- Essai à blanc (DDL injecté à la marque) : 4 sur 4.
--
-- Après application (migration `acces_special_sans_fonctions_mortes`, version
-- 20261008022949), sonde seule : 4 lignes sur 4 conformes —
--   A1 grant_comped_access : ni visiteur ni compte : false/false
--   A2 clear_special_access_note : ni visiteur ni compte : false/false
--   B1 le serveur les garde (service_role) : true/true
--   C1 celles qui servent restent appelables par un compte : true/true
