-- Fix bug critique : les upserts sur `engagement` échouent systématiquement
-- (Postgres 42P10 "no unique or exclusion constraint matching the ON
-- CONFLICT specification") depuis la refonte BDD Sprint 6e (PR-DB-17a).
--
-- Cause : les 4 index uniques ci-dessous sont PARTIELS (WHERE type='...'),
-- mais le client (PostgREST upsert via onConflict) ne peut spécifier qu'une
-- liste de colonnes, jamais le prédicat WHERE d'un index partiel. Postgres
-- exige que la clause ON CONFLICT corresponde exactement à un index/contrainte
-- existant, prédicat inclus — un ON CONFLICT (user_id, target_post_id) sans
-- prédicat ne peut donc jamais matcher engagement_unique_post_like.
-- Conséquence vérifiée en base : table `engagement` totalement vide (0 lignes,
-- tous types) — aucun like, réaction, ou avis n'a jamais pu être écrit.
--
-- Fix : remplacer les 4 index partiels par des index NON partiels incluant
-- `type` dans la clé. `target_post_id` étant partagé par 2 types
-- (post_like ET reaction), un seul index (user_id, type, target_post_id)
-- couvre les deux — sans lui, un utilisateur ne pourrait jamais à la fois
-- liker ET réagir au même post (collision uniquement sur user+post, sans le
-- type). NULL restant toujours distinct de NULL en unicité SQL standard,
-- ces index ne contraignent que les lignes du bon type — pas de régression
-- de comportement pour les 4 fonctions concernées.
--
-- Vérifié empiriquement avant d'écrire cette migration : reproduction du
-- 42P10 puis correctif testés sur une table temporaire (session-locale),
-- pas seulement supposés.

drop index if exists engagement_unique_review;
drop index if exists engagement_unique_post_like;
drop index if exists engagement_unique_reaction;
drop index if exists engagement_unique_reply_like;

create unique index engagement_unique_review
  on public.engagement (user_id, type, target_recipe_id);

-- Couvre à la fois post_like et reaction (cf. explication ci-dessus).
create unique index engagement_unique_post_engagement
  on public.engagement (user_id, type, target_post_id);

create unique index engagement_unique_reply_like
  on public.engagement (user_id, type, target_reply_id);
