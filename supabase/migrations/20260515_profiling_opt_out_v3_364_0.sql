-- ============================================================
-- v3.364.0 — Sprint 10 S10.c.2 — RGPD Article 21 (opposition au profilage)
-- ------------------------------------------------------------
-- Ajoute `profiles.profiling_opted_out` (boolean default false) pour
-- permettre à l'utilisateur de s'opposer au profilage.
--
-- Définition « profilage » dans Fridge+ :
--   - Capture `spending_events` au transfert panier→frigo (alimente le
--     dashboard Analyse Dépenses Premium et les recommandations).
--   - Toute future feature qui construirait un profil comportemental
--     (recos basées sur l'historique de cuisine, IA contextualisée, etc.).
--
-- Lecture obligatoire : la procédure interne de réponse aux incidents + Article 21 RGPD.
--
-- Comportement attendu côté app (à implémenter en S10.c.3 + S10.c.4) :
--   - Toggle dans Profil > Confidentialité (S10.c.3)
--   - `recordSpendingEvent` skip silencieux si profiling_opted_out = true
--     (S10.c.4 — gating côté `@shared/api/spending`)
--   - Données déjà capturées avant l'opt-out : conservées par défaut.
--     Pour effacement complet, l'user passe par Profil > Zone de danger
--     > « Supprimer mon historique de dépenses » (Article 17, futur).
--
-- Note : ce champ est *séparé* de `deleted_at` (Article 17 / droit à
-- l'effacement). Opt-out profilage ≠ suppression du compte.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profiling_opted_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.profiling_opted_out IS
  'RGPD Article 21 — opposition au profilage. true = l''utilisateur a opté pour ne pas être profilé (spending_events skip, futures recos désactivées). Activé via Profil > Confidentialité.';

-- ─── Helper RPC : check profiling status (utilisable côté Edge Functions
-- et triggers PG futurs sans avoir à requêter `profiles` à chaque fois).
-- security_invoker = on : la fonction lit `profiles` avec les droits de
-- l'appelant, donc RLS s'applique (l'user ne peut lire que son propre flag).

CREATE OR REPLACE FUNCTION public.is_profiling_opted_out(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT profiling_opted_out FROM public.profiles WHERE id = p_user_id),
    false
  );
$$;

COMMENT ON FUNCTION public.is_profiling_opted_out(uuid) IS
  'RGPD Article 21 helper — renvoie true si l''user s''est opposé au profilage. false par défaut (et pour les rows manquants).';
