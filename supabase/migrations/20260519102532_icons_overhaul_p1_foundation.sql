-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260519102532) : appliquée
-- sans fichier dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- Elle est en base : ne pas la rejouer.
-- Une ligne de commentaire du corps (le chemin d'une note interne) a été réécrite
-- à l'ouverture du dépôt public (2026-10-09) : l'empreinte ci-dessous est celle du
-- corps tel qu'il est ici, pas celle du registre.
-- ── SQL du registre, recopié tel quel (md5 8c978d9e627ae3e8a83adf513ed38205) ──
-- Icons Overhaul Phase 1 — Foundation BDD
-- Spec : la conception « recipes-ingredients-icons-overhaul » du 2026-05-19
--
-- Ajoute col image_url à ingredients (recipes_unified l'a déjà) + crée 2 buckets
-- Storage publics pour héberger les illustrations AI-générées.
--
-- Rétro-compat 100% : nullable, fallback Twemoji dans composant Emoji.

-- 1) Col image_url sur ingredients
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.ingredients.image_url IS
  'URL de l''illustration ingrédient (Supabase Storage bucket ingredient-icons). Refonte Icons Overhaul P1. Nullable : fallback emoji Twemoji si NULL.';

-- 2) Buckets Storage publics
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('ingredient-icons', 'ingredient-icons', true, 102400,  ARRAY['image/webp', 'image/png']),
  ('recipe-photos',    'recipe-photos',    true, 512000,  ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- 3) RLS policies storage : lecture publique + write admin only
CREATE POLICY ingredient_icons_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'ingredient-icons');

CREATE POLICY ingredient_icons_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ingredient-icons' AND public.is_admin());

CREATE POLICY ingredient_icons_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ingredient-icons' AND public.is_admin())
  WITH CHECK (bucket_id = 'ingredient-icons' AND public.is_admin());

CREATE POLICY ingredient_icons_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ingredient-icons' AND public.is_admin());

CREATE POLICY recipe_photos_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'recipe-photos');

CREATE POLICY recipe_photos_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-photos' AND public.is_admin());

CREATE POLICY recipe_photos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'recipe-photos' AND public.is_admin());

CREATE POLICY recipe_photos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-photos' AND public.is_admin());
