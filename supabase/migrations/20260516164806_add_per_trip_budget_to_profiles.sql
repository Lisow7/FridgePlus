-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260516164806) : appliquée
-- sans fichier dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- Elle est en base : ne pas la rejouer.
-- ── SQL du registre, recopié tel quel (md5 e0a7afc4eda683b142d562ef8532845c) ──
-- v3.412 PR-E : second budget pour limite par course (à côté du
-- monthly_budget existant). Permet à l'user de fixer un seuil à ne
-- pas dépasser sur UNE course (basket courant) — distinct du budget
-- mensuel qui est la somme cumulée des courses du mois.
--
-- Nullable : l'user peut choisir de n'avoir que monthly, que per_trip,
-- les deux, ou aucun. Numeric pour précision (centimes).
-- Premium-only : le check côté UI gate l'affichage du champ.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS per_trip_budget numeric(10,2);

COMMENT ON COLUMN profiles.per_trip_budget IS
'Budget alerte non-bloquant pour UNE course (basket total). Premium only. Distinct de monthly_budget qui cumule le mois.';

