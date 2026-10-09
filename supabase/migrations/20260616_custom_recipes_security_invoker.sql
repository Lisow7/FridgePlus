-- 20260616 — Restaure security_invoker sur la vue custom_recipes.
-- ----------------------------------------------------------------------
-- Le CREATE OR REPLACE VIEW de 20260615 a réinitialisé la vue en SECURITY
-- DEFINER (perte du security_invoker posé par la refonte de mai) → la vue
-- contournait la RLS de recipes_unified (advisor: security_definer_view ERROR).
--
-- security_invoker = true : la RLS du caller s'applique. La policy
-- recipes_unified_select couvre tous les accès du code :
--   is_admin() OU officielles publiées OU community approuvées publiques
--   OU ses propres recettes community.
--
-- ⚠️ Tout futur CREATE OR REPLACE VIEW custom_recipes DOIT inclure
--    `WITH (security_invoker = true)` sinon la régression réapparaît.
-- Idempotent.

ALTER VIEW public.custom_recipes SET (security_invoker = true);
