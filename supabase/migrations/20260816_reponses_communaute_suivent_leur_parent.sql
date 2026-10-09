-- community_replies : une réponse ne doit pas survivre publiquement à la
-- suppression de son parent.
--
-- ── Le défaut ──────────────────────────────────────────────────────────────
--     USING ((deleted_at IS NULL) OR (auth.uid() = user_id))
--
-- La condition ne regarde que la réponse elle-même. Supprimer un post laissait
-- donc ses réponses lisibles par tous, `anon` compris — et supprimer une
-- réponse laissait ses sous-réponses visibles. Une modération ne masquait que
-- la ligne visée, jamais ce qui pendait dessous.
--
-- Prouvé avant correctif (transaction annulée) :
--   anon voit la réponse d'un post SUPPRIMÉ : 1
--   anon voit la sous-réponse d'une réponse SUPPRIMÉE : 1
--
-- ── Pourquoi une fonction, et pas un simple EXISTS ────────────────────────
-- 🔴 Une sous-requête sur `community_replies` DANS la policy de
-- `community_replies` déclenche `42P17: infinite recursion detected in policy`.
-- Vérifié, pas supposé : la version naïve a bien échoué ainsi.
-- La parade est le patron déjà utilisé dans ce projet — une fonction
-- `SECURITY DEFINER` dans le schéma `private`, qui ne redéclenche pas la RLS
-- (et n'apparaît pas dans les advisors, contrairement à `public`).
--
-- ── Effet de bord heureux ─────────────────────────────────────────────────
-- Les sous-requêtes d'une policy subissent la RLS de leurs tables cibles :
-- rendre une réponse invisible masque donc AUSSI, en cascade, les engagements
-- qui la visent (cf. 20260816_engagement_select_verifie_la_cible.sql).
--
-- ── Ce qui ne change pas ──────────────────────────────────────────────────
-- L'auteur voit toujours ses propres réponses, y compris sous un contenu
-- retiré : le premier terme de la policy est inchangé.

CREATE OR REPLACE FUNCTION private.reply_parents_visibles(
  p_post_id         uuid,
  p_parent_reply_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.community_posts p
            WHERE p.id = p_post_id AND p.deleted_at IS NULL
         )
     AND (
           p_parent_reply_id IS NULL
           OR EXISTS (
                SELECT 1 FROM public.community_replies r
                 WHERE r.id = p_parent_reply_id AND r.deleted_at IS NULL
              )
         );
$$;

COMMENT ON FUNCTION private.reply_parents_visibles(uuid, uuid) IS
  'Le post parent (et, le cas échéant, la réponse parente) sont-ils encore visibles ? '
  'SECURITY DEFINER pour éviter la récursion 42P17 dans la policy de community_replies.';

DROP POLICY IF EXISTS community_replies_select ON public.community_replies;

CREATE POLICY community_replies_select ON public.community_replies
FOR SELECT USING (
  (SELECT auth.uid()) = user_id
  OR (
    deleted_at IS NULL
    AND private.reply_parents_visibles(post_id, parent_reply_id)
  )
);
