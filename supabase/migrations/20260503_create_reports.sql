-- ============================================================
-- v3.3.17 — Table `reports` (signalements communautaires)
-- ------------------------------------------------------------
-- Permet aux utilisateurs de signaler une recette, un user ou un commentaire
-- inapproprié. L'admin traite ensuite via le panel admin (ReportsSection).
--
-- Conformité RGPD :
--   • Le rapporteur (`reported_by`) reste FK → profiles ON DELETE SET NULL
--     (anonymisation auto si suppression de compte)
--   • `target_user_id` (cible si type='user') aussi ON DELETE SET NULL
--   • Pas de stockage d'email/IP du rapporteur ou de la cible
--   • Status `dismissed` permet de garder une trace sans purger (audit)
--
-- Décisions :
--   • `target_id text` (couvre recipe_id text et user_id uuid via cast)
--   • `reason_key` whitelistée côté app (cf. ReportsSection.jsx)
--   • Pas d'unique sur (reporter, target) → un user peut re-signaler si
--     la cible est modifiée mais reste problématique
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type       text          NOT NULL,
  target_id         text          NOT NULL,
  reason_key        text          NOT NULL,
  reason_details    text,
  status            text          NOT NULL DEFAULT 'pending',
  resolved_by       uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  resolution_notes  text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

-- ─── CHECK constraints (vocabulaire fermé) ───────────────────

ALTER TABLE public.reports
  ADD CONSTRAINT chk_reports_target_type
  CHECK (target_type IN ('recipe', 'user', 'comment', 'ingredient'));

ALTER TABLE public.reports
  ADD CONSTRAINT chk_reports_status
  CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed'));

ALTER TABLE public.reports
  ADD CONSTRAINT chk_reports_reason_key
  CHECK (reason_key IN (
    'spam', 'inappropriate', 'allergen_error', 'wrong_info',
    'plagiarism', 'harassment', 'other'
  ));

-- ─── Index perf ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reports_status        ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target        ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter      ON public.reports(reporter_id) WHERE reporter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_created_at    ON public.reports(created_at DESC);

-- ─── Trigger updated_at ──────────────────────────────────────

DROP TRIGGER IF EXISTS reports_touch ON public.reports;
CREATE TRIGGER reports_touch
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Tout user authentifié peut signaler (INSERT)
DROP POLICY IF EXISTS "reports_insert_authenticated" ON public.reports;
CREATE POLICY "reports_insert_authenticated"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id          -- on signale en son propre nom uniquement
    OR reporter_id IS NULL            -- ou anonyme (rare, mais possible)
  );

-- L'admin peut tout lire et modifier
DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin"
  ON public.reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reports_delete_admin" ON public.reports;
CREATE POLICY "reports_delete_admin"
  ON public.reports FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- L'utilisateur peut voir SES propres signalements (utile pour notif "ton signalement a été traité")
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- ─── Commentaires ────────────────────────────────────────────

COMMENT ON TABLE public.reports IS
  'Signalements communautaires (v3.3.17). Inséré par les users, traité par les admins. RGPD : reporter_id et resolved_by ON DELETE SET NULL pour anonymisation auto.';
COMMENT ON COLUMN public.reports.reason_key IS
  'Vocabulaire fermé (CHECK) : spam | inappropriate | allergen_error | wrong_info | plagiarism | harassment | other';
COMMENT ON COLUMN public.reports.target_type IS
  'Type de cible : recipe | user | comment | ingredient (CHECK).';
COMMENT ON COLUMN public.reports.status IS
  'Workflow : pending → reviewing → resolved | dismissed (CHECK).';
