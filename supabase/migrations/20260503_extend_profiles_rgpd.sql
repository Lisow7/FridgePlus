-- ============================================================
-- v3.3.12 — Extend `profiles` (4 colonnes RGPD) + vue ingredient_health_check
-- ------------------------------------------------------------
-- Décisions H, K (cf. project_db_architecture_decisions.md) :
--
--   • language (text)                       — sync multi-device de la
--                                              préférence langue (NULL = fallback navigateur)
--   • last_login_at (timestamptz)           — purge auto comptes inactifs (Sprint 8)
--   • consent_terms_accepted_at (timestamptz)    — preuve datée RGPD (CGU)
--   • consent_privacy_accepted_at (timestamptz)  — preuve datée RGPD (politique conf)
--
-- RGPD : pouvoir prouver la DATE d'acceptation est obligatoire. Ces champs
-- sont une donnée d'état du compte (pas un événement), donc mieux ici
-- que dans activity_logs.
--
-- Vue ingredient_health_check : aide admin à détecter les ingrédients avec
-- données manquantes (labels, nutrition, pack_size, default_unit).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language                     text,
  ADD COLUMN IF NOT EXISTS last_login_at                timestamptz,
  ADD COLUMN IF NOT EXISTS consent_terms_accepted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS consent_privacy_accepted_at  timestamptz;

-- ─── CHECK : 5 langues actuelles uniquement
-- (JP sera retiré du sélecteur en v3.3.18 mais on conserve la possibilité
--  en BDD pour les comptes existants qui ont déjà choisi 'ja')

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_language;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_language
  CHECK (language IS NULL OR language IN ('fr','en','es','de','ja'));

-- ─── Index partial : seulement sur les comptes actifs (deleted_at NULL)
-- Optimise la requête de purge inactifs (Sprint 8) : `WHERE last_login_at < now() - interval '12 months' AND deleted_at IS NULL`

CREATE INDEX IF NOT EXISTS idx_profiles_last_login
  ON public.profiles (last_login_at)
  WHERE deleted_at IS NULL;

-- ─── Vue ingredient_health_check ─────────────────────────────
-- Utilisée par la future section admin Data Quality (PR 5 v3.3.16).

CREATE OR REPLACE VIEW public.ingredient_health_check AS
SELECT
  i.id,
  i.labels->>'fr' AS label_fr,
  i.subcategory,
  i.storage,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN COALESCE(i.labels->>'fr','')='' THEN 'missing_label_fr' END,
    CASE WHEN COALESCE(i.labels->>'en','')='' THEN 'missing_label_en' END,
    CASE WHEN COALESCE(i.labels->>'es','')='' THEN 'missing_label_es' END,
    CASE WHEN COALESCE(i.labels->>'de','')='' THEN 'missing_label_de' END,
    CASE WHEN COALESCE(i.labels->>'ja','')='' THEN 'missing_label_ja' END,
    CASE WHEN i.nutrition = '{}'::jsonb        THEN 'missing_nutrition' END,
    CASE WHEN i.pack_size = '{}'::jsonb        THEN 'missing_pack_size' END,
    CASE WHEN i.default_unit IS NULL           THEN 'missing_default_unit' END,
    CASE WHEN i.price = '{}'::jsonb            THEN 'missing_price' END
  ], NULL) AS issues,
  i.updated_at
FROM public.ingredients i;

ALTER VIEW public.ingredient_health_check SET (security_invoker = on);

COMMENT ON VIEW public.ingredient_health_check IS
  'Liste les ingrédients avec issues détectables (labels manquants, nutrition vide, etc.). Utilisée par la section admin Data Quality (PR 5).';

-- ─── Commentaires colonnes profiles

COMMENT ON COLUMN public.profiles.language IS
  'Préférence de langue persistée. NULL = fallback détection navigateur. Sync multi-device.';
COMMENT ON COLUMN public.profiles.last_login_at IS
  'Date du dernier login (mis à jour app-side au signin). Utilisé par la purge auto comptes inactifs (Sprint 8).';
COMMENT ON COLUMN public.profiles.consent_terms_accepted_at IS
  'Date d''acceptation des CGU. RGPD : preuve obligatoire du consentement. NULL = pas encore accepté.';
COMMENT ON COLUMN public.profiles.consent_privacy_accepted_at IS
  'Date d''acceptation de la politique de confidentialité. RGPD : preuve obligatoire.';
