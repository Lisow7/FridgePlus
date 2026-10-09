-- ============================================================
-- v3.12.0 — Saisonnalité des fruits et légumes
-- ------------------------------------------------------------
-- Ajoute une colonne `seasonal_months smallint[]` sur la table
-- `ingredients` pour stocker les mois (1-12) où l'ingrédient est de
-- saison en France métropolitaine (hémisphère nord MVP).
--
-- Sémantique :
--   • NULL                → pas de donnée saisonnière, ingrédient non
--                           éligible au filtre « De saison » et pas de
--                           badge 🌱
--   • Tableau de mois     → l'ingrédient est de saison ces mois-ci
--   • [] (tableau vide)   → réservé pour « jamais de saison ici » mais
--                           on évite, on préfère NULL
--
-- Choix pour le MVP :
--   • Hémisphère nord uniquement (cf. décision validée 2026-05-02).
--     On pourra ajouter `seasonal_months_south` plus tard.
--   • Aucune donnée pour les fruits importés (banane, ananas, mangue…)
--     → NULL → ils n'apparaissent pas dans le filtre, ce qui est exact :
--       ils ne sont pas de saison "ici".
--   • Aucune donnée pour les ingrédients non saisonniers (oignon stocké,
--     pomme de terre stockée, champignons de Paris cultivés…) → NULL.
-- ============================================================

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS seasonal_months smallint[];

-- CHECK : chaque mois est entre 1 et 12, et la longueur du tableau ≤ 12.
-- Postgres n'autorise pas les subqueries dans CHECK → on utilise l'opérateur
-- d'inclusion d'array `<@` (« est contenu dans »).
ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_seasonal_months_check;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_seasonal_months_check
  CHECK (
    seasonal_months IS NULL
    OR (
      array_length(seasonal_months, 1) <= 12
      AND seasonal_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
    )
  );

-- ─── Seed initial — France métropolitaine ───────────────────────────────
-- Les UPDATE sont idempotents (ON CONFLICT pas nécessaire car UPDATE
-- WHERE id = ...). Si l'ID n'existe pas en BDD, l'UPDATE est silencieux.

-- Fruits
UPDATE public.ingredients SET seasonal_months = ARRAY[4,5,6]::smallint[]                  WHERE id = 'fr-fraise';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7]::smallint[]                  WHERE id = 'fr-cerise';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8]::smallint[]                  WHERE id = 'fr-abricot';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'fr-peche';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9]::smallint[]                  WHERE id = 'fr-nectarine';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9]::smallint[]                  WHERE id = 'fr-prune';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'fr-melon';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'fr-pasteque';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'fr-framboise';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9]::smallint[]                  WHERE id = 'fr-myrtille';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8]::smallint[]                  WHERE id = 'fr-groseille';
UPDATE public.ingredients SET seasonal_months = ARRAY[8,9,10,11,12,1,2,3]::smallint[]     WHERE id = 'fr-pomme';
UPDATE public.ingredients SET seasonal_months = ARRAY[8,9,10,11,12,1,2,3]::smallint[]     WHERE id = 'fr-poire';
UPDATE public.ingredients SET seasonal_months = ARRAY[8,9,10]::smallint[]                 WHERE id = 'fr-raisin';
UPDATE public.ingredients SET seasonal_months = ARRAY[11,12,1,2,3,4]::smallint[]          WHERE id = 'fr-orange';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2]::smallint[]           WHERE id = 'fr-mandarine';
UPDATE public.ingredients SET seasonal_months = ARRAY[1,2,3,4,5]::smallint[]              WHERE id = 'fr-citron';
UPDATE public.ingredients SET seasonal_months = ARRAY[11,12,1,2,3,4]::smallint[]          WHERE id = 'fr-kiwi';

-- Légumes
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10,11,12,1]::smallint[]     WHERE id = 'vg-ail';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9,10,11,12,1,2,3,4]::smallint[] WHERE id = 'vg-echalote';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3,4,5]::smallint[]   WHERE id = 'vg-poireau';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10,11,12,1,2]::smallint[]   WHERE id = 'vg-betterave';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3]::smallint[]       WHERE id = 'vg-celeri-rave';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3,4,5]::smallint[]   WHERE id = 'vg-navet';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2,3,4]::smallint[]       WHERE id = 'vg-panais';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2,3]::smallint[]         WHERE id = 'vg-topinambour';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9,10,11,12]::smallint[]         WHERE id = 'vg-celeri';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3]::smallint[]       WHERE id = 'vg-chou';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3,4]::smallint[]     WHERE id = 'vg-chou-fleur';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3]::smallint[]       WHERE id = 'vg-chou-vert';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2,3]::smallint[]       WHERE id = 'vg-chou-rouge';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2,3]::smallint[]         WHERE id = 'vg-chou-kale';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10,11]::smallint[]          WHERE id = 'vg-blettes';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2]::smallint[]           WHERE id = 'vg-chou-bruxelles';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1,2]::smallint[]         WHERE id = 'vg-chou-romanesco';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9,10]::smallint[]           WHERE id = 'vg-chou-rave';
UPDATE public.ingredients SET seasonal_months = ARRAY[8,9,10,11,12]::smallint[]           WHERE id = 'vg-brocoli';
UPDATE public.ingredients SET seasonal_months = ARRAY[4,5,6]::smallint[]                  WHERE id = 'vg-asperges';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'vg-haricots-v';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7]::smallint[]                  WHERE id = 'vg-petits-pois';
UPDATE public.ingredients SET seasonal_months = ARRAY[4,5,6,9,10,11]::smallint[]          WHERE id = 'vg-epinards';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7]::smallint[]                  WHERE id = 'vg-pois-m-tout';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6]::smallint[]                    WHERE id = 'vg-feves';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9,10]::smallint[]               WHERE id = 'vg-aubergine';
UPDATE public.ingredients SET seasonal_months = ARRAY[7,8,9,10]::smallint[]               WHERE id = 'vg-poivron';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9]::smallint[]                WHERE id = 'vg-courgette';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1]::smallint[]           WHERE id = 'vg-patate-douce';
UPDATE public.ingredients SET seasonal_months = ARRAY[4,5,6,7,8,9]::smallint[]            WHERE id = 'vg-oignon-vert';
UPDATE public.ingredients SET seasonal_months = ARRAY[4,5,6,7,8,9,10]::smallint[]         WHERE id = 'vg-radis';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9]::smallint[]              WHERE id = 'vg-laitue';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9]::smallint[]              WHERE id = 'vg-salade-verte';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9]::smallint[]              WHERE id = 'vg-roquette';
UPDATE public.ingredients SET seasonal_months = ARRAY[11,12,1,2,3]::smallint[]            WHERE id = 'vg-mache';
UPDATE public.ingredients SET seasonal_months = ARRAY[10,11,12,1,2,3,4]::smallint[]       WHERE id = 'vg-endives';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10]::smallint[]             WHERE id = 'vg-tomate';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10]::smallint[]             WHERE id = 'vg-tomate-cerise';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9]::smallint[]              WHERE id = 'vg-artichaut';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12,1]::smallint[]           WHERE id = 'vg-butternut';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12]::smallint[]             WHERE id = 'vg-potimarron';
UPDATE public.ingredients SET seasonal_months = ARRAY[9,10,11,12]::smallint[]             WHERE id = 'vg-potiron';
UPDATE public.ingredients SET seasonal_months = ARRAY[5,6,7,8,9]::smallint[]              WHERE id = 'vg-concombre';
UPDATE public.ingredients SET seasonal_months = ARRAY[6,7,8,9,10,11]::smallint[]          WHERE id = 'vg-fenouil';
