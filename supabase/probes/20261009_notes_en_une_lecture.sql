-- Sonde de la migration 20261010014610_notes_en_une_lecture.sql : la vue
-- recipe_rating_aggregates existe, sous les droits de l'appelant, lisible par
-- anon et authenticated, et ses chiffres sont ceux d'un calcul direct.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit — même l'essai à blanc du DDL est
-- annulé. Le « message d'erreur » est le rapport ; une ligne « ⚠ » est un écart.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  n int;
  v text;
BEGIN
  SELECT count(*) INTO n FROM information_schema.views
   WHERE table_schema = 'public' AND table_name = 'recipe_rating_aggregates';
  r := r || E'\nA1 vue avant — attendu 0 : ' || n || CASE WHEN n = 0 THEN '' ELSE ' (déjà appliquée)' END;

  -- ESSAI À BLANC : la migration, puis la vérification ; tout est annulé à la fin.
  CREATE OR REPLACE VIEW public.recipe_rating_aggregates
  WITH (security_invoker = true) AS
    SELECT target_recipe_id AS recipe_id,
           round(avg(rating)::numeric, 1) AS avg,
           count(*)::integer AS count
      FROM public.engagement
     WHERE type = 'review' AND deleted_at IS NULL AND rating BETWEEN 1 AND 5
     GROUP BY target_recipe_id;
  ALTER VIEW public.recipe_rating_aggregates SET (security_invoker = on);
  GRANT SELECT ON public.recipe_rating_aggregates TO anon, authenticated;

  SELECT coalesce(array_to_string(c.reloptions, ','), '') INTO v
    FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
   WHERE s.nspname = 'public' AND c.relname = 'recipe_rating_aggregates';
  r := r || E'\nB1 security_invoker — attendu true : '
    || CASE WHEN v ~ 'security_invoker=(true|on)' THEN 'true' ELSE 'false ⚠' END; -- l'ALTER range « on », le CREATE « true »
  r := r || E'\nB2 lecture anon/authenticated — attendu true/true : '
    || has_table_privilege('anon', 'public.recipe_rating_aggregates', 'SELECT')::text || '/'
    || has_table_privilege('authenticated', 'public.recipe_rating_aggregates', 'SELECT')::text;
  SELECT count(*) INTO n FROM public.recipe_rating_aggregates;
  r := r || E'\nB3 recettes notées par la vue / calcul direct — attendu égaux : ' || n || ' / '
    || (SELECT count(DISTINCT target_recipe_id) FROM public.engagement
         WHERE type = 'review' AND deleted_at IS NULL AND rating BETWEEN 1 AND 5);
  r := r || E'\nB4 somme des comptes / avis vivants — attendu égaux : '
    || coalesce((SELECT sum(count) FROM public.recipe_rating_aggregates), 0) || ' / '
    || (SELECT count(*) FROM public.engagement
         WHERE type = 'review' AND deleted_at IS NULL AND rating BETWEEN 1 AND 5);

  RAISE EXCEPTION 'SONDE notes_en_une_lecture :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).