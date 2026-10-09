-- Sonde de la migration 20261006_allergenes_avec_accord.sql : les allergènes
-- d'un compte ne s'enregistrent qu'avec un accord explicite, daté par la base
-- (décision du 2026-10-06, « allergenes = case »).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Elle joue, dans la peau d'un compte ordinaire, ce que le navigateur envoie :
-- les deux fonctions de l'accord, l'écriture des allergènes
-- (`updateProfile({ allergen_prefs })`), et les écritures directes de la date
-- qu'un navigateur trafiqué tenterait. L'écriture porte sur un vrai profil sans
-- allergène ; tout est annulé par le RAISE final. La contrainte « aucun
-- allergène sans accord » a sa propre sonde (migration d'après la release).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  u uuid;
  r text := '';
BEGIN
  SELECT p.id INTO u FROM public.profiles p
   WHERE p.role = 'user' AND COALESCE(p.banned, false) = false AND p.deleted_at IS NULL
     AND COALESCE(cardinality(p.allergen_prefs), 0) = 0
   ORDER BY p.created_at LIMIT 1;
  IF u IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un compte ordinaire sans allergène';
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
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  -- A. Dans la peau du compte : la date de l'accord se pose par la base.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A2 se donner une date d''accord ANTIDATÉE', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET allergen_consent_at = now() - interval ''1 year'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('A3 donner son accord (accepter_l_enregistrement_des_allergenes)', 'ACCEPTÉ',
    'SELECT public.accepter_l_enregistrement_des_allergenes()');
  RESET ROLE;
  r := r || public.__sonde_valeur('A4 la date posée est celle du serveur', 'true',
    format('SELECT (allergen_consent_at = now())::text FROM public.profiles WHERE id = %L', u));

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A5 avec l''accord, enregistrer ses allergènes', 'ACCEPTÉ',
    format('UPDATE public.profiles SET allergen_prefs = ''{gluten,arachide}'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('A6 redonner son accord ne change pas la date (une seule pose)', 'ACCEPTÉ',
    'SELECT public.accepter_l_enregistrement_des_allergenes()');
  r := r || public.__sonde_ligne('A7 changer la date d''un accord déjà donné', 'REFUSÉ 42501',
    format('UPDATE public.profiles SET allergen_consent_at = now() + interval ''30 seconds'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('A9 retirer son accord (retirer_l_accord_allergenes)', 'ACCEPTÉ',
    'SELECT public.retirer_l_accord_allergenes()');
  RESET ROLE;
  r := r || public.__sonde_valeur('A10 le retrait efface les allergènes ET la date', '0 NULL',
    format('SELECT COALESCE(cardinality(allergen_prefs), 0)::text || '' '' || COALESCE(allergen_consent_at::text, ''NULL'') FROM public.profiles WHERE id = %L', u));

  -- B. Un visiteur ne peut rien ; les droits et le catalogue.
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_ligne('B1 visiteur : donner un accord', 'REFUSÉ 42501',
    'SELECT public.accepter_l_enregistrement_des_allergenes()');
  RESET ROLE;
  r := r || public.__sonde_valeur('B3 le déclencheur : SECURITY DEFINER, search_path vide, fermé à l''API', 'true true 0',
    $q$SELECT prosecdef::text || ' ' || (proconfig = ARRAY['search_path=""'])::text || ' ' ||
              (SELECT count(*) FROM unnest(ARRAY['public','anon','authenticated']) AS role(nom)
                WHERE has_function_privilege(role.nom, 'private.garder_l_accord_allergenes()'::regprocedure, 'EXECUTE'))::text
         FROM pg_proc WHERE oid = 'private.garder_l_accord_allergenes()'::regprocedure$q$);
  r := r || public.__sonde_valeur('B4 les deux fonctions : SECURITY INVOKER, ouvertes aux comptes seulement', 'false false t f t f',
    $q$SELECT string_agg(x, ' ' ORDER BY o) FROM (
         SELECT 1 AS o, prosecdef::text AS x FROM pg_proc WHERE oid = 'public.accepter_l_enregistrement_des_allergenes()'::regprocedure
         UNION ALL SELECT 2, prosecdef::text FROM pg_proc WHERE oid = 'public.retirer_l_accord_allergenes()'::regprocedure
         UNION ALL SELECT 3, left(has_function_privilege('authenticated', 'public.accepter_l_enregistrement_des_allergenes()', 'EXECUTE')::text, 1)
         UNION ALL SELECT 4, left(has_function_privilege('anon', 'public.accepter_l_enregistrement_des_allergenes()', 'EXECUTE')::text, 1)
         UNION ALL SELECT 5, left(has_function_privilege('authenticated', 'public.retirer_l_accord_allergenes()', 'EXECUTE')::text, 1)
         UNION ALL SELECT 6, left(has_function_privilege('anon', 'public.retirer_l_accord_allergenes()', 'EXECUTE')::text, 1)) s$q$);

  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-06, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT (sonde complète, contrainte comprise) : 13 écarts sur 14 — ni colonne,
--   ni fonctions, ni déclencheur ; seul l'enregistrement d'allergènes passait.
-- ESSAI À BLANC n° 1 (avec la contrainte) : 0 écart sur 14. La contrainte a
--   ensuite été SORTIE de cette migration : l'app en production (sans la case)
--   écrit encore les allergènes sans accord, la refuser aurait cassé ce réglage
--   jusqu'à la release — elle attend dans 20261006_allergenes_contrainte_apres_release.sql.
-- ESSAI À BLANC n° 2 (fichier final, composé par script) : 0 écart sur 11.
-- APRÈS application (`allergenes_avec_accord`, version 20261006114940) :
--   0 écart sur 11. Vérifié ensuite : aucun profil touché (ni date, ni
--   allergène), aucune fonction de sonde restante.
