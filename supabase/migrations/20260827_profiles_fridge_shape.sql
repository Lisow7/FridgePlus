-- Forme du frigo choisissable dans Profil > Préférences (2026-08-27).
-- La forme (type de layout) est découplée de la langue : la langue ne fournit
-- plus que les libellés, la forme vient de cette préférence.
-- NULL = défaut applicatif « top-freezer » (le même pour tout le monde,
-- décision user du 2026-08-27 — les invités n'ont pas de ligne ici et
-- retombent sur le même défaut côté client).
-- text + CHECK nommée plutôt qu'un enum natif : liste appelée à évoluer
-- (multi-door dort déjà dans le code) et contrainte modifiable sans casse.
alter table public.profiles
  add column if not exists fridge_shape text
  constraint profiles_fridge_shape_check
  check (fridge_shape in ('top-freezer', 'side-by-side'));

comment on column public.profiles.fridge_shape is
  'Forme du frigo choisie par l''utilisateur (préférence UI). NULL = défaut top-freezer. La RLS de profiles (ligne = propriétaire) s''applique telle quelle.';
