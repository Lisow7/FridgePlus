-- Anti-gaspi 1A — fraîcheur du stock. Ajoute la date d'ajout (pour dériver la
-- péremption via la durée par défaut de la sous-catégorie) + un override manuel
-- optionnel. Idempotente. RLS/PK inchangées.
ALTER TABLE public.user_stock
  ADD COLUMN IF NOT EXISTS added_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

COMMENT ON COLUMN public.user_stock.added_at IS
  'Date d''ajout au frigo. Base de calcul de la fraicheur (added_at + duree par defaut sous-categorie). Cutover : lignes existantes = now() -> vert au lancement (intentionnel).';
COMMENT ON COLUMN public.user_stock.expires_at IS
  'Override manuel optionnel de la date de peremption. NULL = calcul par defaut.';
