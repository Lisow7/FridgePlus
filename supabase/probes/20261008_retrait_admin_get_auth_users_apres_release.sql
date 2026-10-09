-- Sonde de `20261008_retrait_admin_get_auth_users_apres_release.sql` : plus
-- aucun compte ne peut appeler `admin_get_auth_users()`, et le seul chemin
-- vers un e-mail reste `admin_reveler_compte`, réservé aux administrateurs.
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

  r := r || public.__sonde_valeur('A1 ni visiteur ni compte connecté n''appellent admin_get_auth_users', 'false/false',
    $q$SELECT has_function_privilege('anon', 'public.admin_get_auth_users()', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.admin_get_auth_users()', 'EXECUTE')::text$q$);
  r := r || public.__sonde_valeur('A2 le chemin tracé reste ouvert aux comptes connectés (la fonction filtre les admins)', 'false/true',
    $q$SELECT has_function_privilege('anon', 'public.admin_reveler_compte(uuid, text)', 'EXECUTE')::text || '/' ||
              has_function_privilege('authenticated', 'public.admin_reveler_compte(uuid, text)', 'EXECUTE')::text$q$);

  RAISE EXCEPTION 'SONDE retrait_admin_get_auth_users :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).