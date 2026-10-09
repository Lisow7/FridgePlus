-- R-05 — Détection de doublon à la création de recette.
-- Renvoie les recettes VISIBLES (officielles + communautaires approuvées
-- publiques) les plus similaires à (nom, ingrédients). Indicatif : aide le
-- contributeur à éviter les doublons.
--
-- SECURITY INVOKER : la fonction ne lit que des lignes déjà visibles par un
-- utilisateur authentifié (officielles + approuvées publiques via RLS) — pas
-- besoin de DEFINER ni de sa surface d'attaque. search_path fixé par hygiène.
-- Nom matché sur coalesce(nullif(title,''), name->>'fr') : les recettes
-- officielles peuvent avoir title NULL et le nom dans le jsonb name.
-- Idempotent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.find_similar_recipes(
  p_name           text,
  p_ingredient_ids text[],
  p_exclude_id     text DEFAULT NULL
)
RETURNS TABLE (id text, title text, score real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  -- sim_ing = indice de Jaccard (intersection / union) entre les ids passés et
  -- les ids de la recette. Évite les faux positifs du ratio simple : 1 ingrédient
  -- commun sur une grosse recette donne 1/N (faible), pas 1.0.
  WITH candidates AS (
    SELECT
      r.id,
      coalesce(nullif(r.title, ''), r.name->>'fr') AS disp_title,
      similarity(
        lower(coalesce(nullif(r.title, ''), r.name->>'fr', '')),
        lower(coalesce(p_name, ''))
      ) AS sim_name,
      ARRAY(
        SELECT DISTINCT e_id
        FROM jsonb_array_elements(r.ingredients) AS ing
        CROSS JOIN LATERAL jsonb_array_elements_text(ing -> 'ids') AS e_id
      ) AS r_ids
    FROM recipes_unified r
    WHERE (r.origin = 'official' OR (r.is_public = true AND r.moderation_status = 'approved'))
      AND (p_exclude_id IS NULL OR r.id <> p_exclude_id)
  ),
  scored AS (
    SELECT id, disp_title, sim_name,
      CASE
        WHEN r_ids IS NULL OR cardinality(p_ingredient_ids) = 0 THEN 0::real
        ELSE (
          cardinality(ARRAY(SELECT unnest(p_ingredient_ids) INTERSECT SELECT unnest(r_ids)))::real
          / NULLIF(cardinality(ARRAY(SELECT unnest(p_ingredient_ids) UNION SELECT unnest(r_ids))), 0)::real
        )
      END AS sim_ing
    FROM candidates
  )
  SELECT id, disp_title AS title, greatest(sim_name, sim_ing)::real AS score
  FROM scored
  WHERE greatest(sim_name, sim_ing) >= 0.4
  ORDER BY score DESC
  LIMIT 3;
$$;

-- INVOKER → la RLS du caller s'applique ; on restreint quand même l'exécution
-- aux comptes connectés (la détection sert au formulaire de création).
REVOKE EXECUTE ON FUNCTION public.find_similar_recipes(text, text[], text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.find_similar_recipes(text, text[], text) TO authenticated;

COMMENT ON FUNCTION public.find_similar_recipes(text, text[], text) IS
  'R-05 — top 3 recettes visibles similaires (pg_trgm nom + ratio ingrédients). Indicatif, anti-doublon création. SECURITY INVOKER ; nom = coalesce(title, name->>fr).';
