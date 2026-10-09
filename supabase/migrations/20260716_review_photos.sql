-- Chantier avis recettes + communauté (PR2, 2026-07-16) : photo partagée
-- depuis un avis, publiée en post communauté (catégorie 'pride').
-- Voir la conception « avis-recettes-communaute » du 2026-07-16

-- 1. Colonne photo_url sur community_posts.
alter table public.community_posts add column if not exists photo_url text;

-- 2. Défense en profondeur : le rôle authenticated ne peut jamais définir ou
--    modifier photo_url lui-même. Seule l'Edge Function moderate-content
--    (via service_role, qui contourne la RLS) la renseigne, après
--    vérification de modération de l'image. Le client n'appelle jamais
--    createPost/updatePost avec une photo (cf. spec §3).
alter policy "Authenticated insert posts" on public.community_posts
  with check (auth.uid() = user_id and photo_url is null);

alter policy "Authors update own posts" on public.community_posts
  using (auth.uid() = user_id and deleted_by_admin = false)
  with check (auth.uid() = user_id and deleted_by_admin = false and photo_url is null);

-- 3. Bucket public review-photos — même principe que recipe-photos déjà en
--    place : aucune policy authenticated sur storage.objects, seul
--    service_role (Edge Function) écrit. Lecture publique via l'URL (le
--    flag buckets.public=true suffit, pas besoin de policy SELECT — même
--    précédent que la migration 20260617_security_bucket_no_listing.sql).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
