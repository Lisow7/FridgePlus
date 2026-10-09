-- ============================================================================
-- `ai_cache` : restreindre la lecture publique aux seules suggestions
-- Date : 2026-08-13
-- Origine : audit RLS empirique du 2026-08-13 (balayage des 33 tables).
--
-- CE QUI EXISTAIT
-- `ai_cache_public_select` : `USING (true)`. N'importe qui, connecte ou non,
-- lit toute la table.
--
-- POURQUOI C'EST UN PROBLEME
-- Ce n'est pas une fuite constatee — soyons precis :
--   • la table n'a **aucune colonne `user_id`** : une entree n'est attribuable
--     a personne ;
--   • `cache_key` est un `sha256`, le contenu n'est pas recuperable, seulement
--     CONFIRMABLE par devinette exacte ;
--   • au 2026-08-13 elle contient **3 lignes, toutes `feature='substitute'`**
--     (suggestions culinaires generiques). **Zero ligne de moderation.**
--
-- Le vrai motif est plus simple : **cette policy n'a aucun consommateur.**
--   • Les deux edge functions qui utilisent le cache (`moderate-content`,
--     `suggest-substitutes`) le lisent avec `supabaseAdmin`, construit sur
--     `SB_SECRET_KEY` — donc en `service_role`, qui **contourne la RLS**.
--   • Le module client `src/shared/lib/ai/` (qui contient `getFromCache`) n'est
--     importe QUE par un fichier de test : il importe `node:crypto`, et il est
--     **absent du bundle de production** (verifie sur `dist/assets/*.js`).
-- Une surface de lecture publique qui ne sert personne n'a pas lieu d'exister.
--
-- Et elle grandira : `moderate-content` ecrit dans la MEME table avec
-- `feature = 'moderation'`, dont la cle est `sha256(model:contenu utilisateur)`
-- et la reponse le verdict de moderation. Rien de nominatif, mais un oracle de
-- confirmation sur du contenu soumis — inutile de l'exposer.
--
-- CHOIX : RESTREINDRE PLUTOT QUE SUPPRIMER
-- `USING (feature = 'substitute')` plutot qu'un `DROP POLICY` :
--   • si un chemin client non mesure lisait les suggestions, il continue ;
--   • supprimer la seule policy laisserait la table avec RLS active et AUCUNE
--     policy, ce que certains linters Supabase signalent.
-- Les ecritures etaient deja reservees au `service_role` (aucune policy
-- INSERT/UPDATE/DELETE) : cette policy SELECT est toute la surface anonyme.
--
-- PREUVE (dry-run du 2026-08-13 sur la base de production, dans un bloc DO
-- termine par RAISE EXCEPTION — donc integralement annule ; verifie apres coup :
-- 3 lignes, 0 ligne de test, policy d'origine restauree) :
--   une entree `moderation` factice a ete inseree, puis :
--     AVANT : anon voit 4 lignes, moderation comprise
--     APRES : anon voit 3 `substitute`, et 0 `moderation`
--
-- ROLLBACK :
--   DROP POLICY IF EXISTS ai_cache_public_select ON public.ai_cache;
--   CREATE POLICY ai_cache_public_select ON public.ai_cache
--     FOR SELECT USING (true);
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS ai_cache_public_select ON public.ai_cache;

CREATE POLICY ai_cache_public_select ON public.ai_cache
  FOR SELECT
  USING (feature = 'substitute');

COMMIT;
