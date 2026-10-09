-- ============================================================
-- v3.11.0 — Création de la table `cooking_logs` (Journal de cuisine)
-- ------------------------------------------------------------
-- Une ligne par recette cuisinée par l'utilisateur. Alimente :
--   • le compteur global « X recettes cuisinées »
--   • la liste « Dernières recettes cuisinées » dans le profil
--
-- Insertion déclenchée à la validation du retrait des ingrédients
-- (RecipeModal step 2) ou à la fin du Mode cuisine plein écran.
--
-- RGPD :
--   • RLS user-only (lecture, insert, delete sur ses propres logs)
--   • Pas d'UPDATE (un log de cuisine est immuable, audit-like)
--   • ON DELETE CASCADE pour purger lors de la suppression compte
--   • Aucune PII (juste recipe_id + servings + date)
--   • Conservation : pas de purge automatique, mais l'utilisateur
--     peut supprimer son compte à tout moment (cascade)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cooking_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id      text        NOT NULL,
  recipe_source  text        NOT NULL CHECK (recipe_source IN ('base', 'custom', 'community')),
  servings       smallint    CHECK (servings IS NULL OR (servings > 0 AND servings < 100)),
  cooked_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Index : listing chronologique par user (le cas d'usage principal)
CREATE INDEX IF NOT EXISTS idx_cooking_logs_user_cooked
  ON public.cooking_logs (user_id, cooked_at DESC);

-- ─── RLS : user-only sur ses propres logs
ALTER TABLE public.cooking_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users select own cooking logs" ON public.cooking_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users insert own cooking logs" ON public.cooking_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users delete own cooking logs" ON public.cooking_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Volontairement pas de policy UPDATE : un log est immuable.
