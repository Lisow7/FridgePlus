-- ============================================================
-- v3.3.17 — Consolidation : reports → support_tickets
-- ------------------------------------------------------------
-- Décision validée 2026-05-02 : éviter le système parallèle entre
-- `reports` et `support_tickets` (les deux gèrent des "signalements"
-- aux yeux de l'admin). On consolide en étendant `support_tickets`
-- avec les colonnes structurées de signalement.
--
-- Cette migration supersede `20260503_create_reports.sql` (table créée
-- mais jamais utilisée). On la DROP et on enrichit `support_tickets`.
--
-- Workflow nouveau :
--   • Bouton « 🚩 Signaler » dans SupportPanel.jsx → ticket type='report'
--     avec target_type + target_id + reason_key remplis
--   • Onglet « Signalements » du panel admin → filtre support_tickets
--     par type='report', affichage structuré (cible, raison, statut)
--   • Onglet Support reste pour question/request (et report si on veut
--     gérer la conversation user↔admin)
-- ============================================================

-- ─── 1. DROP table reports (créée par erreur en début v3.3.17) ───────────────
-- IF EXISTS pour ne pas planter si déjà drop ou jamais créée.

DROP TABLE IF EXISTS public.reports;

-- ─── 2. Étendre support_tickets avec les 3 colonnes structurées ──────────────
-- Ces colonnes ne sont remplies QUE pour les tickets type='report'.
-- NULL acceptable pour question/request.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS target_type  text,
  ADD COLUMN IF NOT EXISTS target_id    text,
  ADD COLUMN IF NOT EXISTS reason_key   text;

-- ─── 3. CHECK constraints (vocabulaires fermés) ──────────────────────────────

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS chk_support_tickets_target_type;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT chk_support_tickets_target_type
  CHECK (target_type IS NULL OR target_type IN ('recipe', 'user', 'comment', 'ingredient'));

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS chk_support_tickets_reason_key;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT chk_support_tickets_reason_key
  CHECK (reason_key IS NULL OR reason_key IN (
    'spam', 'inappropriate', 'allergen_error', 'wrong_info',
    'plagiarism', 'harassment', 'other'
  ));

-- Cohérence : si type='report', target_type doit être renseigné (incitation
-- à utiliser le workflow structuré côté app).
-- Note : on ne force PAS via CHECK pour ne pas bloquer les anciens tickets
-- type='report' qui n'ont pas ces colonnes (NULL acceptable).
-- L'app valide côté SupportPanel pour les nouveaux tickets.

-- ─── 4. Index pour les filtres admin ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_target
  ON public.support_tickets (target_type, target_id)
  WHERE target_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_reason_key
  ON public.support_tickets (reason_key)
  WHERE reason_key IS NOT NULL;

-- ─── Commentaires ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.support_tickets.target_type IS
  'v3.3.17 — type de cible signalée (recipe/user/comment/ingredient). NULL pour question/request.';
COMMENT ON COLUMN public.support_tickets.target_id IS
  'v3.3.17 — ID de la cible signalée. NULL pour question/request.';
COMMENT ON COLUMN public.support_tickets.reason_key IS
  'v3.3.17 — raison normalisée du signalement (vocabulaire fermé via CHECK). NULL pour question/request.';
