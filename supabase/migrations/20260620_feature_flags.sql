-- Feature flags — gate léger (Vague 0).
-- Interrupteur on/off par fonctionnalité, activable par l'admin sans
-- redéploiement. Lecture publique (le front gate même pour les invités) ;
-- écriture réservée à l'admin via public.is_admin(). Idempotente.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  label       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.feature_flags IS
  'Flags on/off par fonctionnalité. Lecture publique, écriture admin (is_admin). Gate léger Vague 0.';

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- SELECT : tout le monde (anon + authenticated) — les flags ne sont pas secrets
-- et le front doit pouvoir gater même un invité.
DROP POLICY IF EXISTS "feature_flags_select_all" ON public.feature_flags;
CREATE POLICY "feature_flags_select_all"
  ON public.feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- UPDATE : admin seul.
DROP POLICY IF EXISTS "feature_flags_update_admin" ON public.feature_flags;
CREATE POLICY "feature_flags_update_admin"
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT : admin seul (ajout de nouveaux flags depuis l'app si besoin ;
-- le seed initial vient de cette migration).
DROP POLICY IF EXISTS "feature_flags_insert_admin" ON public.feature_flags;
CREATE POLICY "feature_flags_insert_admin"
  ON public.feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Seed des features fast-follow — désactivées (invisibles tant que non câblées).
INSERT INTO public.feature_flags (key, enabled, label, description) VALUES
  ('scan_barcode',       false, 'Scan code-barres',        'Ajout d''ingrédient emballé via Open Food Facts (fast-follow).'),
  ('filter_presets',     false, 'Presets de filtres',      'Chips rapides Vide-frigo / Rapide & sain / Petit budget (fast-follow).'),
  ('community_rails',    false, 'Rails communauté',        'Follow + capture « J''ai cuisiné ! » (fast-follow).'),
  ('push_notifications', false, 'Notifications push PWA',  'Push web en plus de la cloche in-app (fast-follow).')
ON CONFLICT (key) DO NOTHING;
