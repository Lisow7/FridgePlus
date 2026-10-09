-- ============================================================
-- v3.370.0 — Sprint 10 S10.c.8 — RGPD : purge comptes inactifs (warn + soft-delete)
-- ------------------------------------------------------------
-- Implémente la durée de conservation des comptes inactifs documentée
-- dans `legal-content.js` et le registre RGPD interne TR-01 :
--
--   3 ans sans login → email de relance (`inactive_warned_at = now()`)
--   30 jours sans réaction → soft-delete (`deleted_at = now()`)
--   (puis le job `anonymize_soft_deleted_profiles` existant prend le relais
--   30 jours plus tard pour l'anonymisation effective)
--
-- Flow total : 3y + 30d + 30d ≈ 3 ans et 2 mois entre dernier login et
-- anonymisation effective. RGPD-compliant (Article 5.1.e — limitation
-- de conservation + Article 21 — droit d'information avant suppression).
--
-- ⚠️  Email step : ce migration NE FAIT PAS l'envoi d'email. Il scanne
-- les candidats et expose une vue `inactive_accounts_to_warn`. Une
-- Edge Function (TODO post-launch) doit :
--   1. Lire `inactive_accounts_to_warn`
--   2. Pour chaque row : envoyer email Resend `inactive-reminder-fr/en`
--   3. Mettre à jour `inactive_warned_at = now()` après succès
--
-- Tant que l'Edge Function n'est pas wirée, `inactive_warned_at` reste
-- NULL et le job `soft_delete_inactive_warned` ne supprime personne.
-- Ce design fail-safe garantit qu'aucun user n'est supprimé sans
-- avoir été préalablement notifié.
-- ============================================================

-- ─── 1. Colonne `inactive_warned_at` sur profiles ───────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inactive_warned_at timestamptz;

COMMENT ON COLUMN public.profiles.inactive_warned_at IS
  'RGPD Art. 5.1.e — Date d''envoi de l''email de relance pour compte inactif (3 ans sans login). NULL = pas encore notifié. Set par l''Edge Function `notify-inactive` après envoi Resend. 30j après ce timestamp, le compte est soft-deleted par `soft_delete_inactive_warned` cron job.';

-- ─── 2. Vue `inactive_accounts_to_warn` ─────────────────────────────────────
-- Liste les comptes éligibles à l'envoi de l'email de relance.
-- L'Edge Function `notify-inactive` lit cette vue, envoie les emails, et
-- met à jour `inactive_warned_at` post-succès.

CREATE OR REPLACE VIEW public.inactive_accounts_to_warn AS
SELECT
  p.id,
  p.username,
  p.language,
  p.last_login_at,
  -- L'email est en auth.users (pas profiles) ; on le joint pour que
  -- l'Edge Function ait tout le contexte en une requête.
  u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.deleted_at IS NULL
  AND p.inactive_warned_at IS NULL
  AND p.last_login_at IS NOT NULL
  AND p.last_login_at < now() - interval '3 years';

-- security_invoker = on : la vue lit avec les droits de l'appelant.
-- Comme `auth.users` est restreint aux admins/service_role, seule la
-- Edge Function (qui tourne en service_role) pourra lire cette vue.
ALTER VIEW public.inactive_accounts_to_warn SET (security_invoker = on);

COMMENT ON VIEW public.inactive_accounts_to_warn IS
  'RGPD Art. 5.1.e — Liste les comptes inactifs depuis > 3 ans à notifier (email Resend). Lue par l''Edge Function `notify-inactive`. Une fois l''email envoyé, l''Edge Function met `profiles.inactive_warned_at = now()`.';

-- ─── 3. Cron job : soft-delete des comptes warned > 30j ─────────────────────
-- Tourne quotidiennement à 03:45 UTC (créneau libre vs autres jobs RGPD).
-- Ne touche QUE les profils dont `inactive_warned_at` est non-NULL ET
-- > 30 jours, ce qui garantit que l'user a été préalablement notifié.

SELECT public._reschedule_cron(
  'soft_delete_inactive_warned',
  '45 3 * * *',
  $$UPDATE public.profiles
    SET deleted_at = now()
    WHERE deleted_at IS NULL
      AND inactive_warned_at IS NOT NULL
      AND inactive_warned_at < now() - interval '30 days'
      AND last_login_at < now() - interval '3 years';$$
);

-- ─── 4. RPC helper : réactivation au login ──────────────────────────────────
-- À appeler côté Edge Function au signin pour reset le compteur si l'user
-- revient avant la soft-delete (cas : email reçu → click pour revenir).
-- Le reset libère le compte du process : last_login_at = now() le sortira
-- de la vue, et inactive_warned_at est remis à NULL pour qu'un futur
-- cycle d'inactivité fonctionne normalement.

CREATE OR REPLACE FUNCTION public.reset_inactive_warning(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET inactive_warned_at = NULL
  WHERE id = p_user_id AND inactive_warned_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.reset_inactive_warning(uuid) IS
  'RGPD Art. 5.1.e helper — Reset le flag inactive_warned_at quand un user revient se connecter avant la soft-delete. À appeler côté Edge Function au signin (idempotent : no-op si déjà NULL).';
