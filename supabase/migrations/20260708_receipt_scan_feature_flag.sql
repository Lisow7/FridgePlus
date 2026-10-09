-- supabase/migrations/20260708_receipt_scan_feature_flag.sql
-- Flag garde-fou pour le scan de ticket de caisse (dev→main du 2026-07-08).
-- Le code (FAB "Photo du ticket") est déjà déployé sans flag jusqu'ici ;
-- le chemin de succès (vraie photo → vrais ingrédients ajoutés) n'a jamais
-- été testé avec un ticket réel avant ce release. Désactivé par défaut,
-- à activer une fois ce test fait.

INSERT INTO public.feature_flags (key, enabled, label, description)
VALUES (
  'receipt_scan',
  false,
  'Scan de ticket de caisse',
  'Scan de ticket de caisse -> ajout d''ingredients (Google Vision). Chemin de succes avec un vrai ticket jamais teste au 2026-07-08 -> a tester avant activation.'
)
ON CONFLICT (key) DO NOTHING;
