-- Ajout colonne metadata jsonb sur activity_logs
-- ----------------------------------------------------------------------
-- Permet de stocker des détails contextuels d'une action admin sans
-- multiplier les colonnes : raison de l'accès aux données sensibles,
-- avant/après d'un UPDATE, etc.
--
-- Utilisée par sensitiveAudit.logSensitiveDataAccess() pour stocker la
-- raison normalisée (clé + détails libres) lors d'une consultation
-- d'email / IP / last_sign_in.
--
-- Idempotente.

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.activity_logs.metadata IS
  'Détails contextuels JSONB d''une action admin : raison normalisée pour les accès sensibles, avant/après d''un UPDATE, etc. Whitelist applicative — jamais d''email/IP/données perso (cf. project_security_hardening.md).';
