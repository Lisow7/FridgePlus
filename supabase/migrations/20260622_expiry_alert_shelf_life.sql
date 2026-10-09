-- Anti-gaspi 1C — source SERVEUR du shelf-life (miroir de src/shared/static/shelf-life.js).
-- Le JS reste la source FRONT (fraicheur live, invites hors-ligne) ; cette table sert
-- au cron de peremption (calcul serveur). Synchronisation garantie par shelf-life-db-sync.test.js.

CREATE TABLE IF NOT EXISTS public.shelf_life_days (
  subcategory text PRIMARY KEY,
  days        int  NOT NULL CHECK (days > 0)
);

-- RLS : lecture publique (donnee non sensible), aucune ecriture client.
ALTER TABLE public.shelf_life_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shelf_life_days_select ON public.shelf_life_days;
CREATE POLICY shelf_life_days_select ON public.shelf_life_days FOR SELECT USING (true);

-- Seed (= SHELF_LIFE_DAYS JS). Format 1 tuple/ligne pour parsing par le test anti-drift.
INSERT INTO public.shelf_life_days (subcategory, days) VALUES
  ('fish', 2),
  ('meat', 3),
  ('bread', 4),
  ('ready-meals', 4),
  ('deli', 5),
  ('herbs', 5),
  ('dairy', 7),
  ('fruits', 7),
  ('vegetables', 7),
  ('tropical-fruits', 7),
  ('tofu', 10),
  ('vegan-proteins', 10),
  ('cheese', 21),
  ('eggs', 21),
  ('frozen-bread', 120),
  ('frozen-fish', 180),
  ('frozen-meat', 180),
  ('ice-cream', 180),
  ('frozen-veg', 240),
  ('sauces', 180),
  ('cereals', 180),
  ('nuts-dried', 180),
  ('sweet', 180),
  ('basic', 180),
  ('oils', 365),
  ('dry', 365),
  ('salt-spices', 720),
  ('canned', 730),
  ('pasta-rice', 730),
  ('rice', 730)
ON CONFLICT (subcategory) DO UPDATE SET days = EXCLUDED.days;
