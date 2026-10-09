-- v3.128.0 — Budget de courses (colonne `monthly_budget` sur `profiles`)
--
-- Champ optionnel : NULL par défaut (aucune limite).
-- L'utilisateur fixe librement un montant indicatif et peut le supprimer
-- à tout moment. Comparé au total du panier courant (pas d'historique
-- de dépenses stocké — RGPD minimal).
--
-- Contrainte : valeur strictement positive si renseignée (0 interdit).
-- Précision : 2 décimales, max 999 999,99 € (numeric(8,2)).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_budget numeric(8,2)
  CONSTRAINT chk_profiles_monthly_budget CHECK (monthly_budget IS NULL OR monthly_budget > 0);

COMMENT ON COLUMN public.profiles.monthly_budget IS
  'Budget courses indicatif fixé par l''utilisateur (en €). NULL = aucune limite. Comparé au total du panier courant.';
