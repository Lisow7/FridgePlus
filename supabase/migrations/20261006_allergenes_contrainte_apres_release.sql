-- 2026-10-06 — Aucun allergène enregistré sans accord : la base le tient.
-- Seconde moitié de 20261006_allergenes_avec_accord.sql (décision du
-- 2026-10-06, « allergenes = case » ; RGPD art. 9.2.a).
--
-- 🔴 À APPLIQUER JUSTE APRÈS LA MISE EN PRODUCTION de la version qui demande
-- l'accord. Avant, l'ancienne version (sans la case) écrit les allergènes sans
-- accord : cette contrainte casserait ce réglage en production.
--
-- AVANT D'APPLIQUER, compter (lecture seule) :
--   SELECT count(*) FROM public.profiles
--    WHERE COALESCE(cardinality(allergen_prefs), 0) > 0 AND allergen_consent_at IS NULL;
-- 0 → appliquer. Plus de 0 → NE PAS appliquer : ces comptes ont enregistré des
-- allergènes sans accord entre-temps. Les effacer est une décision d'Antoine
-- (une donnée de santé sans base légale, mais une vraie donnée de ses
-- utilisateurs) : lui demander, puis effacer, puis appliquer.
--
-- Retour arrière : ALTER TABLE public.profiles DROP CONSTRAINT
-- profiles_allergenes_avec_accord;
--
-- Sonde : supabase/probes/20261006_allergenes_contrainte_apres_release.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_allergenes_avec_accord
  CHECK (COALESCE(cardinality(allergen_prefs), 0) = 0 OR allergen_consent_at IS NOT NULL);

COMMIT;
