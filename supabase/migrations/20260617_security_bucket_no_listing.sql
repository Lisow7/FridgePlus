-- Sécurité pré-launch (audit 2026-06-17, F-SEC2) — retire la policy SELECT
-- large sur les buckets PUBLICS `ingredient-icons` et `recipe-photos`.
--
-- Ces policies (`bucket_id = '...'` pour le rôle `public`) autorisaient le
-- LISTING de tous les fichiers via l'API storage. Les buckets étant publics
-- (`buckets.public = true`), l'accès par URL publique (`/object/public/...`)
-- ne dépend PAS de ces policies → l'affichage des images reste intact, seul
-- le listing/énumération est supprimé. Aucun code client n'utilise `.list()`
-- sur ces buckets (vérifié). Lint Supabase 0025.

DROP POLICY IF EXISTS "ingredient_icons_public_read" ON storage.objects;
DROP POLICY IF EXISTS "recipe_photos_public_read"   ON storage.objects;
