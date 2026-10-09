-- ============================================================
-- v3.15.2 — Charte de la communauté Fridge+
-- ------------------------------------------------------------
-- Ajoute un champ `community_terms_accepted_at` sur profiles pour
-- prouver l'acceptation datée de la charte (preuve RGPD).
--
-- Sémantique :
--   • NULL  → l'utilisateur n'a pas (encore) accepté → mode lecture
--             seule dans le panneau communauté
--   • date  → preuve datée de l'acceptation → accès complet
--
-- L'utilisateur peut révoquer son acceptation à tout moment depuis
-- Profil → Préférences (passe la colonne à NULL). C'est cohérent avec
-- le principe RGPD du retrait du consentement (Art. 7).
--
-- Côté UX, un drapeau localStorage `fridge-community-terms-seen`
-- évite de re-afficher la modale à chaque accès si l'utilisateur a
-- explicitement refusé. Ce drapeau est purement local (pas RGPD-
-- relevant — la preuve de l'acceptation reste en BDD).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_terms_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.community_terms_accepted_at IS
  'v3.15.2 — Preuve datée de l''acceptation de la charte de la communauté. NULL = pas accepté (lecture seule).';
