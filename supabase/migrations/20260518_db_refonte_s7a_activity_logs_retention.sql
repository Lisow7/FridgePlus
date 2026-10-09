-- ============================================================
-- v0.16.x — Refonte BDD Sprint 7a — activity_logs retention 12 mois (PR-DB-18)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings RGPD : `project_db_refonte_findings_2026_05_17.md` (Art 5.1.e
-- storage limitation + CNIL Free Mobile €27M en 2026 pour défaut retention)
--
-- Comble le dernier trou retention RGPD : `activity_logs` (journal admin
-- append-only) n'avait pas de purge automatique. Conformément à la
-- documentation existante de la table (« Rétention 12 mois (purge via
-- pg_cron — à venir) »), on crée le cron job hebdomadaire qui DELETE
-- les rows > 12 mois.
--
-- 6 autres cron jobs RGPD déjà actifs avant cette PR :
--   - anonymize_soft_deleted_profiles (30j post-soft-delete)
--   - purge_expired_notifications (expires_at < now)
--   - purge_old_resolved_tickets (resolved > 24 mois)
--   - purge_read_notifications (read > 6 mois)
--   - purge-shared-baskets (expires_at < now)
--   - soft_delete_inactive_warned (3y inactivité + 30j warning)
--
-- Cette PR ajoute le 7ème : purge_old_activity_logs.
--
-- Pas d'effet immédiat (oldest log = 2026-04-28, < 12 mois). S'activera
-- automatiquement quand le premier log atteindra 12 mois (avril 2027).
-- ============================================================

SELECT public._reschedule_cron(
  'purge_old_activity_logs',
  '0 4 * * 1',
  $$DELETE FROM public.activity_logs WHERE created_at < now() - interval '12 months';$$
);
