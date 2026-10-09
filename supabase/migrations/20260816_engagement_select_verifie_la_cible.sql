-- engagement_select : ne plus rendre publique une réaction dont la CIBLE ne l'est pas.
--
-- ── Le défaut ──────────────────────────────────────────────────────────────
-- La policy autorisait la lecture sur le seul `deleted_at IS NULL` :
--
--     USING (is_admin() OR auth.uid() = user_id OR deleted_at IS NULL)
--
-- Le troisième terme est un OU sans condition sur la cible. Un avis ou une
-- réaction restait donc lisible par n'importe qui — `anon` compris — même si le
-- post ou la recette visés étaient supprimés ou non publiés. L'engagement
-- révélait alors l'existence d'un contenu qui, lui, ne l'était pas.
--
-- ── Pourquoi maintenant, alors que rien n'est exposé ───────────────────────
-- Mesuré le 2026-08-16 : 0 recette communauté, 0 recette non publiée, 0 post
-- vivant. Le trou est aujourd'hui INATTEIGNABLE — et c'est exactement ce qui
-- rend le moment favorable. Resserrer une policy sur une table de 4 lignes est
-- trivial et vérifiable ; le faire après l'ouverture publique, sur du contenu
-- réel et du trafic, ne l'est plus.
--
-- ── Ce qui a été prouvé avant d'écrire ce fichier ──────────────────────────
-- Tests joués en `DO` + `RAISE EXCEPTION` (donc intégralement annulés) :
--   • policy resserrée + post VIVANT créé pour l'occasion
--       → anon lit le post : 1, anon voit la réaction dessus : 1  ✅
--     Les sous-requêtes d'une policy subissent la RLS des tables cibles : ce
--     test écarte le risque de masquer des engagements parfaitement publics.
--   • sur les données réelles
--       → les 2 réactions visibles pointaient vers des posts SUPPRIMÉS ;
--         elles disparaissent, ce qui est le correctif, pas une régression.
--   • aucune récursion (42P17) : les sous-requêtes portent sur d'autres tables
--     que `engagement`.
--
-- Les chemins `is_admin()` et « je lis mes propres lignes » sont inchangés :
-- un auteur voit toujours ses engagements, y compris sur un contenu retiré.

DROP POLICY IF EXISTS engagement_select ON public.engagement;

CREATE POLICY engagement_select ON public.engagement
FOR SELECT USING (
  is_admin()
  OR (SELECT auth.uid()) = user_id
  OR (
    deleted_at IS NULL
    -- …et la cible doit être elle-même publiquement atteignable.
    AND (
      target_recipe_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.recipes_unified r
         WHERE r.id = engagement.target_recipe_id
           AND r.deleted_at IS NULL
           AND r.status = 'published'
      )
    )
    AND (
      target_post_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_posts p
         WHERE p.id = engagement.target_post_id
           AND p.deleted_at IS NULL
      )
    )
    -- ⚠️ La table a TROIS cibles, pas deux. `target_reply_id` a failli être
    -- oublié — ce qui aurait laissé visible une réaction sur une réponse
    -- supprimée, et reproduit à l'identique le défaut qu'on corrige ici.
    AND (
      target_reply_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_replies rep
         WHERE rep.id = engagement.target_reply_id
           AND rep.deleted_at IS NULL
      )
    )
  )
);
