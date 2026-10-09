-- Sonde de la migration 20261006_allergenes_contrainte_apres_release.sql :
-- aucun allergène enregistré sans accord, tenu par la base (décision du
-- 2026-10-06, « allergenes = case »). À jouer avant (écarts attendus), en
-- essai à blanc, puis après l'application — JUSTE APRÈS LA RELEASE.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit.
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

  -- C0. Aucun compte n'a d'allergène sans accord (sinon : NE PAS appliquer).
  r := r || public.__sonde_valeur('C0 comptes avec des allergènes mais sans accord', '0',
    $q$SELECT count(*)::text FROM public.profiles WHERE COALESCE(cardinality(allergen_prefs), 0) > 0 AND allergen_consent_at IS NULL$q$);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 enregistrer un allergène SANS accord', 'REFUSÉ 23514',
    format('UPDATE public.profiles SET allergen_prefs = ''{gluten}'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('C2 donner son accord, puis enregistrer ses allergènes', 'ACCEPTÉ',
    format('SELECT public.accepter_l_enregistrement_des_allergenes(); UPDATE public.profiles SET allergen_prefs = ''{gluten}'' WHERE id = %L', u));
  r := r || public.__sonde_ligne('C3 effacer la date en gardant les allergènes', 'REFUSÉ 23514',
    format('UPDATE public.profiles SET allergen_consent_at = NULL WHERE id = %L', u));
  r := r || public.__sonde_ligne('C4 retirer son accord efface tout d''un geste', 'ACCEPTÉ',
    'SELECT public.retirer_l_accord_allergenes()');
  RESET ROLE;
  r := r || public.__sonde_valeur('C5 la contrainte existe', 'CHECK',
    $q$SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'profiles_allergenes_avec_accord'$q$);

  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).