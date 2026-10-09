-- ============================================================
-- v3.51.0 — Listes de courses sauvegardées (Phase L.1)
-- ------------------------------------------------------------
-- Permet à l'utilisateur de sauvegarder son panier actuel sous forme
-- d'une liste nommée, qu'il peut ensuite renommer/recharger/supprimer.
--
-- Architecture choisie : items en jsonb monolithique dans la même table
-- (vs table dédiée shopping_list_items). Justification :
--   - Simple : 1 seule table, pas de jointure
--   - Snapshot du panier au moment de la sauvegarde — on n'a pas besoin de
--     muter les items individuellement (toujours en bloc)
--   - jsonb est nativement requêtable au besoin (jsonb_array_length, etc.)
--   - Cohérent avec custom_recipes.data qui utilise déjà ce pattern
--
-- Format `items` : Array<{ ingredient_id, label, amount, unit, price,
--   recipe_id?, recipe_name?, recipe_servings?, recipe_servings_initial?,
--   amount_initial?, checked? }> — copie des champs de basket_items.
--
-- RGPD :
--   - Cascade DELETE depuis auth.users → suppression compte = suppression
--     listes (Art. 17 — droit à l'effacement)
--   - RLS strict : utilisateur ne voit/modifie que ses propres listes
--   - À inclure dans l'export RGPD (cf. src/lib/db/dataExport.js, à mettre
--     à jour dans la PR Phase L.2)
--   - Pas d'échange tiers, pas de cross-user
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + ALTER TABLE conditionnel.
-- ============================================================

-- ─── 1. Table shopping_lists ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopping_lists IS
  'v3.51.0 — Listes de courses sauvegardées par l''utilisateur. items = snapshot des basket_items au moment de la sauvegarde. Cascade DELETE sur auth.users (RGPD Art. 17).';

COMMENT ON COLUMN public.shopping_lists.items IS
  'Array<{ingredient_id, label, amount, unit, price, recipe_id?, recipe_name?, ...}> — snapshot du panier.';

-- ─── 2. Index pour les requêtes fréquentes ──────────────────────────
-- Listing des listes d'un user ordonnées par dernière modif (cas d'usage
-- principal : afficher « Mes listes » triées récent → ancien).
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_updated
  ON public.shopping_lists (user_id, updated_at DESC);

-- ─── 3. Trigger updated_at automatique ──────────────────────────────
CREATE OR REPLACE FUNCTION public.shopping_lists_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopping_lists_updated_at ON public.shopping_lists;
CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.shopping_lists_set_updated_at();

-- ─── 4. Row Level Security ──────────────────────────────────────────
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS pour idempotence (relance de la migration)
DROP POLICY IF EXISTS "shopping_lists_select_own" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_insert_own" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_update_own" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_delete_own" ON public.shopping_lists;

CREATE POLICY "shopping_lists_select_own"
  ON public.shopping_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "shopping_lists_insert_own"
  ON public.shopping_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shopping_lists_update_own"
  ON public.shopping_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shopping_lists_delete_own"
  ON public.shopping_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── 5. Limite anti-abus (50 listes max par utilisateur) ────────────
-- Garde-fou simple côté BDD pour éviter qu'un utilisateur ne crée des
-- milliers de listes accidentellement (ou volontairement). Le frontend
-- doit afficher un message clair quand cette limite est atteinte.
CREATE OR REPLACE FUNCTION public.check_shopping_lists_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.shopping_lists
   WHERE user_id = NEW.user_id;
  IF v_count >= 50 THEN
    RAISE EXCEPTION 'Limite atteinte : 50 listes maximum par utilisateur.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopping_lists_check_limit ON public.shopping_lists;
CREATE TRIGGER shopping_lists_check_limit
  BEFORE INSERT ON public.shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.check_shopping_lists_limit();

-- [release-action: appliquer cette migration sur Supabase Studio (SQL Editor)]
-- [release-action: lancer `npm run db:types` apres la migration pour regenerer les types TypeScript]
