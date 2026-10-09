-- Fix sécurité : community_can_post(uid) / community_can_reply(uid) sont des
-- fonctions SECURITY DEFINER exposées via /rest/v1/rpc/... et acceptaient un
-- `uid` arbitraire sans jamais vérifier qu'il correspondait à l'appelant.
-- N'importe quel utilisateur connecté pouvait donc sonder, pour un UUID
-- arbitraire : (1) si ce user est actuellement muté communauté
-- (community_muted_until), (2) s'il a atteint son quota de posts/replies des
-- dernières 24h. Trouvé lors d'un audit sécurité (2026-07-19), voir
-- l'audit de sécurité du 2026-07-19 (note interne).
--
-- Le seul appelant client (src/shared/api/community.js: canPost/canReply)
-- passe TOUJOURS user.id (l'utilisateur connecté courant) — jamais un uid
-- arbitraire — donc ce garde ne casse aucun usage légitime.
--
-- Retourne `false` (plutôt que RAISE EXCEPTION) pour un uid usurpé : ça
-- reproduit exactement le comportement "ne peut pas poster" sans donner
-- d'oracle distinct entre "muté"/"quota atteint"/"pas toi".

create or replace function public.community_can_post(uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_catalog'
as $$
  select
    uid = auth.uid()
    and
    not exists (
      select 1 from public.profiles
      where id = uid and community_muted_until is not null
        and community_muted_until > now()
    )
    and
    (select count(*) from public.community_posts
     where user_id = uid
       and created_at > now() - interval '1 day'
       and deleted_at is null) < 5;
$$;

create or replace function public.community_can_reply(uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_catalog'
as $$
  select
    uid = auth.uid()
    and
    not exists (
      select 1 from public.profiles
      where id = uid and community_muted_until is not null
        and community_muted_until > now()
    )
    and
    (select count(*) from public.community_replies
     where user_id = uid
       and created_at > now() - interval '1 day'
       and deleted_at is null) < 30;
$$;
