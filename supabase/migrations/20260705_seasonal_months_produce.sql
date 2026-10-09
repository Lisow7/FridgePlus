-- Peuple `ingredients.seasonal_months` (calendrier fruits & légumes de saison,
-- France métropolitaine / hémisphère nord — réf. ADEME / Greenpeace).
--
-- Contexte : la colonne était vide sur les 653 ingrédients → le filtre « Saison »
-- (recipeHasSeasonalIngredient) affichait toujours (0). On peuple UNIQUEMENT les
-- fruits & légumes réellement saisonniers qui apparaissent dans les recettes.
--
-- Choix de conception : on LAISSE NULL les staples ubiquitaires disponibles toute
-- l'année (oignon, ail, échalote, pomme de terre, champignon de Paris, germes de
-- soja, salade/laitue) et les fruits importés année pleine (agrumes verts,
-- tropicaux, citron). Sinon quasi toutes les recettes contiendraient un ingrédient
-- « de saison » (oignon/ail partout) et le filtre perdrait tout sens.
--
-- Idempotent : réexécutable (UPDATE par id). Non destructif ailleurs.
-- Écriture DB-directe SÛRE : le script sync-ingredients.mjs (npm run migrate)
-- n'inclut PAS seasonal_months dans son upsert → ne l'écrasera pas.

update ingredients i set seasonal_months = v.months::smallint[]
from (values
  -- ── Légumes ──────────────────────────────────────────────────────────
  ('vg-asperges',     array[4,5,6]),
  ('vg-aubergine',    array[6,7,8,9,10]),
  ('vg-betterave',    array[1,2,3,9,10,11,12]),
  ('vg-blettes',      array[5,6,7,8,9,10,11]),
  ('vg-brocoli',      array[6,7,8,9,10,11]),
  ('vg-butternut',    array[1,2,9,10,11,12]),
  ('vg-carottes',     array[1,2,3,9,10,11,12]),
  ('vg-celeri',       array[6,7,8,9,10,11,12]),
  ('vg-celeri-rave',  array[1,2,3,9,10,11,12]),
  ('vg-chou',         array[1,2,3,9,10,11,12]),
  ('vg-chou-chinois', array[3,4,9,10,11,12]),
  ('vg-chou-fleur',   array[3,4,5,9,10,11,12]),
  ('vg-chou-kale',    array[1,2,3,10,11,12]),
  ('vg-chou-rouge',   array[1,2,9,10,11,12]),
  ('vg-chou-vert',    array[1,2,3,9,10,11,12]),
  ('vg-concombre',    array[5,6,7,8,9]),
  ('vg-courges',      array[1,2,9,10,11,12]),
  ('vg-courgette',    array[5,6,7,8,9,10]),
  ('vg-cresson',      array[3,4,5,9,10,11]),
  ('vg-daikon',       array[1,2,10,11,12]),
  ('vg-endives',      array[1,2,3,4,10,11,12]),
  ('vg-epinards',     array[3,4,5,9,10,11]),
  ('vg-fenouil',      array[6,7,8,9,10]),
  ('vg-gombo',        array[7,8,9,10]),
  ('vg-haricots-v',   array[6,7,8,9,10]),
  ('vg-mache',        array[1,2,3,10,11,12]),
  ('vg-navet',        array[1,2,3,4,10,11,12]),
  ('vg-oignon-vert',  array[3,4,5,6,7,8]),
  ('vg-pak-choi',     array[3,4,9,10,11,12]),
  ('vg-patate-douce', array[1,2,9,10,11,12]),
  ('vg-petits-pois',  array[5,6,7]),
  ('vg-poireau',      array[1,2,3,4,9,10,11,12]),
  ('vg-pois-m-tout',  array[5,6,7]),
  ('vg-poivron',      array[7,8,9,10]),
  ('vg-potimarron',   array[1,2,9,10,11,12]),
  ('vg-potiron',      array[1,2,9,10,11,12]),
  ('vg-radis',        array[3,4,5,6,7,8,9,10]),
  ('vg-roquette',     array[4,5,6,7,8,9,10]),
  ('vg-tomate',       array[6,7,8,9,10]),
  ('vg-tomate-cerise',array[6,7,8,9,10]),
  ('vg-tomate-ronde', array[6,7,8,9,10]),
  ('vg-tomatillo',    array[7,8,9,10]),
  -- ── Fruits (tempérés) ────────────────────────────────────────────────
  ('fr-abricot',   array[6,7,8]),
  ('fr-baies',     array[6,7,8,9]),
  ('fr-clem',      array[1,11,12]),
  ('fr-fraise',    array[4,5,6,7]),
  ('fr-framboise', array[6,7,8,9]),
  ('fr-mandarine', array[1,2,11,12]),
  ('fr-melon',     array[6,7,8,9]),
  ('fr-myrtille',  array[7,8,9]),
  ('fr-orange',    array[1,2,3,11,12]),
  ('fr-pasteque',  array[7,8,9]),
  ('fr-poire',     array[1,2,3,8,9,10,11,12]),
  ('fr-pomme',     array[1,2,3,4,8,9,10,11,12]),
  ('fr-raisin',    array[8,9,10])
) as v(id, months)
where i.id = v.id;
