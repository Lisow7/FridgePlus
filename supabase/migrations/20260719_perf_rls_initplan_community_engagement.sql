-- Perf : get_advisors (2026-07-19) signale 3 policies qui ré-évaluent
-- auth.uid() par ligne au lieu d'une seule fois par requête. Fix recommandé
-- par Supabase : remplacer auth.uid() par (select auth.uid()) — le
-- planificateur Postgres peut alors traiter l'appel comme un InitPlan
-- (évalué une fois), au lieu d'un appel par ligne. Pur no-op sémantique,
-- aucun changement de comportement RLS.
-- Voir l'audit des advisors du 2026-07-19 (note interne).

drop policy "Authenticated insert posts" on public.community_posts;
create policy "Authenticated insert posts" on public.community_posts
for insert
with check ((select auth.uid()) = user_id and photo_url is null);

drop policy "Authors update own posts" on public.community_posts;
create policy "Authors update own posts" on public.community_posts
for update
using ((select auth.uid()) = user_id and deleted_by_admin = false)
with check ((select auth.uid()) = user_id and deleted_by_admin = false and photo_url is null);

drop policy "engagement_update" on public.engagement;
create policy "engagement_update" on public.engagement
for update
using (is_admin() or ((select auth.uid()) = user_id and deleted_by_admin = false))
with check (is_admin() or (select auth.uid()) = user_id);
