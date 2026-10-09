-- Phase 4 — B.1 : Infrastructure abonnements Stripe
--
-- 1. Colonnes Stripe + abonnement dans profiles
-- 2. Table subscription_events (audit trail RGPD, append-only)
-- 3. RPC grant_comped_access (SECURITY DEFINER — seul point d'entrée pour l'accès offert)

-- ─── 1. Colonnes abonnement dans profiles ────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN stripe_customer_id  text        UNIQUE,
  ADD COLUMN subscription_status text        NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN (
      'free',       -- gratuit, pas d'abonnement
      'trialing',   -- période d'essai Stripe active
      'active',     -- abonnement Stripe actif et à jour
      'past_due',   -- paiement en retard
      'canceled',   -- abonnement résilié
      'paused',     -- abonnement en pause
      'comped'      -- accès offert manuellement par un admin
    )),
  ADD COLUMN trial_ends_at        timestamptz,
  ADD COLUMN subscription_ends_at timestamptz,
  ADD COLUMN subscription_plan    text
    CHECK (subscription_plan IN ('monthly', 'annual') OR subscription_plan IS NULL);

-- Index pour les requêtes fréquentes (admin dashboard, MRR, conversions)
CREATE INDEX profiles_subscription_status_idx
  ON public.profiles (subscription_status);

-- ─── 2. Table audit trail RGPD ───────────────────────────────────────────
--
-- Append-only : aucune politique DELETE → conservation garantie
-- Sert à la fois aux events Stripe (stripe_event_id renseigné) et aux
-- actions admin manuelles (stripe_event_id NULL, granted_by renseigné)

CREATE TABLE public.subscription_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_event_id  text        UNIQUE,          -- NULL pour les actions admin manuelles
  event_type       text        NOT NULL,         -- ex: customer.subscription.updated | admin_comp_granted
  previous_status  text,
  new_status       text,
  granted_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL, -- admin acteur
  processed_at     timestamptz DEFAULT now(),
  raw_payload      jsonb
);

-- RLS : lecture admin uniquement — aucune politique INSERT/UPDATE/DELETE pour les clients
-- (seuls le SECURITY DEFINER RPC et la service_role du webhook peuvent écrire)
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_subscription_events"
  ON public.subscription_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 3. RPC grant_comped_access — SECURITY DEFINER ───────────────────────
--
-- Seul point d'entrée autorisé pour définir subscription_status = 'comped'.
-- Exécuté en tant que postgres (superuser), contourne RLS mais vérifie
-- explicitement que l'appelant JWT est un admin avant toute action.
-- Chaque appel est tracé dans subscription_events (audit trail RGPD).

CREATE OR REPLACE FUNCTION public.grant_comped_access(
  p_target_user_id  uuid,
  p_action          text   -- 'grant' | 'revoke'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    text;
  v_prev_status    text;
  v_new_status     text;
BEGIN
  -- 1. Vérifier que l'appelant est admin (lecture du profil via JWT)
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Valider le paramètre action
  IF p_action NOT IN ('grant', 'revoke') THEN
    RAISE EXCEPTION 'Invalid action: must be ''grant'' or ''revoke'''
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Récupérer le statut actuel de la cible
  SELECT subscription_status INTO v_prev_status
  FROM profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Calculer le nouveau statut
  v_new_status := CASE p_action
    WHEN 'grant'  THEN 'comped'
    WHEN 'revoke' THEN 'free'
  END;

  -- 5. Mettre à jour le profil (atomique avec l'étape 6)
  UPDATE profiles
  SET
    subscription_status = v_new_status,
    updated_at          = now()
  WHERE id = p_target_user_id;

  -- 6. Audit trail RGPD (append-only, jamais supprimé)
  INSERT INTO subscription_events (
    user_id, event_type, previous_status, new_status, granted_by, raw_payload
  ) VALUES (
    p_target_user_id,
    CASE p_action
      WHEN 'grant'  THEN 'admin_comp_granted'
      WHEN 'revoke' THEN 'admin_comp_revoked'
    END,
    v_prev_status,
    v_new_status,
    auth.uid(),
    jsonb_build_object(
      'action',     p_action,
      'granted_by', auth.uid()::text,
      'timestamp',  now()::text
    )
  );
END;
$$;

-- Restreindre l'accès : seuls les utilisateurs authentifiés peuvent appeler le RPC
-- (la vérification admin se fait à l'intérieur de la fonction)
REVOKE ALL ON FUNCTION public.grant_comped_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_comped_access(uuid, text) TO authenticated;
