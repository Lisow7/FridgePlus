-- 2026-10-06 — Deux durées de conservation tenues par la base.
-- Décision du 2026-10-06, choix d'Antoine :
--   « purge_usage = oui »    : effacer les statistiques d'usage au bout de 13 mois ;
--   « ban_sans_fin = 3_ans » : l'empreinte d'une adresse bannie ne vit pas sans fin.
-- Audit du 2026-10-04 : RGPD-01 et BDD-11 (rien n'effaçait `product_events`).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. `private.retenir_l_empreinte` : l'empreinte gardée à l'effacement d'un
--    compte banni vit jusqu'à la fin du bannissement, et 3 ans au plus. Un
--    bannissement « sans fin » (p_fin NULL) en donnait une sans fin ; une
--    empreinte d'adresse reste une donnée personnelle, le RGPD veut une durée.
--    La colonne `jusqu_au` devient NOT NULL (aucune ligne au 2026-10-06 ; une
--    ligne sans fin écrite d'ici l'application prend 3 ans à compter de sa
--    création).
-- 2. Tâche `purge_adresses_interdites_echues` (chaque jour, 4 h 25 UTC) : une
--    empreinte échue n'interdit plus rien (le refus lit `jusqu_au > now()`) ;
--    elle est effacée.
-- 3. Tâche `purge_product_events_13_mois` (chaque jour, 4 h 35 UTC) : un
--    événement d'usage est effacé 13 mois après `occurred_at`, la durée que la
--    politique annonce. Au 2026-10-06 : 1 135 lignes, la plus ancienne du
--    2026-07-01, donc rien ne sera effacé avant août 2027.
--
-- Ce qui ne change pas : la règle du refus (`refuser_une_adresse_interdite`,
-- déclencheur sur `auth.users`) n'est pas touchée.
--
-- Retour arrière : `SELECT cron.unschedule('purge_product_events_13_mois');`,
-- `SELECT cron.unschedule('purge_adresses_interdites_echues');`, remettre la
-- `retenir_l_empreinte` de 20261006_bannis_ne_se_reinscrivent_pas.sql, puis
-- `ALTER TABLE private.adresses_interdites ALTER COLUMN jusqu_au DROP NOT NULL;`.
--
-- Sonde : supabase/probes/20261006_durees_de_conservation_tenues.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION private.retenir_l_empreinte(p_email text, p_banni boolean, p_fin timestamptz)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(p_banni, false) AND (p_fin IS NULL OR p_fin > now()) AND p_email IS NOT NULL THEN
    INSERT INTO private.adresses_interdites (empreinte, jusqu_au)
    VALUES (private.empreinte_adresse(p_email), LEAST(COALESCE(p_fin, 'infinity'), now() + interval '3 years'))
    ON CONFLICT (empreinte) DO UPDATE
      SET jusqu_au = GREATEST(private.adresses_interdites.jusqu_au, EXCLUDED.jusqu_au);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.retenir_l_empreinte(text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;

UPDATE private.adresses_interdites SET jusqu_au = cree_le + interval '3 years' WHERE jusqu_au IS NULL;
ALTER TABLE private.adresses_interdites ALTER COLUMN jusqu_au SET NOT NULL;

SELECT cron.schedule('purge_adresses_interdites_echues', '25 4 * * *', $$DELETE FROM private.adresses_interdites WHERE jusqu_au < now()$$);
SELECT cron.schedule('purge_product_events_13_mois', '35 4 * * *', $$DELETE FROM public.product_events WHERE occurred_at < now() - interval '13 months'$$);

COMMIT;
