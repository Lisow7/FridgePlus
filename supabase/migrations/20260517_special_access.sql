-- ============================================================
-- Chantier C : Special Access Admin
-- ============================================================

-- 1. Colonne special_role sur profiles (source de vérité runtime)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS special_role text
    CHECK (special_role IN ('tester','support','influencer','partner') OR special_role IS NULL);

-- 2. Table special_access (audit trail + notes admin)
CREATE TABLE IF NOT EXISTS public.special_access (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role                  text NOT NULL
    CHECK (role IN ('tester','support','influencer','partner')),
  note                  text,
  granted_by            uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  granted_at            timestamptz NOT NULL DEFAULT now(),
  revoked_at            timestamptz,
  revoked_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Snapshot de l'état Stripe avant attribution (pour restauration à la révocation)
  previous_status       text,
  previous_plan         text,
  previous_ends_at      timestamptz,
  UNIQUE (user_id)
);

-- 3. RLS sur special_access — admins uniquement, mutations via RPC seulement
ALTER TABLE public.special_access ENABLE ROW LEVEL SECURITY;

-- Utiliser is_admin() SECURITY DEFINER (déjà créée par 20260430_admin_rls_policies.sql)
-- pour éviter la récursion RLS et pour la cohérence avec les autres tables.
CREATE POLICY "special_access_admin_select"
  ON public.special_access FOR SELECT
  USING (is_admin());

-- Pas de policy INSERT/UPDATE/DELETE directe : mutations via RPC SECURITY DEFINER uniquement

-- ============================================================
-- RPC 1 : grant_special_access
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_special_access(
  p_user_id   uuid,
  p_role      text,
  p_note      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role       text;
  v_prev_status       text;
  v_prev_plan         text;
  v_prev_ends_at      timestamptz;
  v_existing_active   boolean;
BEGIN
  -- 1. Vérifier que l'appelant est admin
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Valider le rôle
  IF p_role NOT IN ('tester','support','influencer','partner') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 3. Lire l'état Stripe actuel
  SELECT subscription_status, subscription_plan, subscription_ends_at
  INTO v_prev_status, v_prev_plan, v_prev_ends_at
  FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- 4. Vérifier s'il y a déjà un rôle actif (pour ne pas écraser le snapshot original)
  SELECT EXISTS(
    SELECT 1 FROM special_access WHERE user_id = p_user_id AND revoked_at IS NULL
  ) INTO v_existing_active;

  -- 5. UPSERT dans special_access
  INSERT INTO special_access (
    user_id, role, note, granted_by, granted_at,
    previous_status, previous_plan, previous_ends_at
  )
  VALUES (
    p_user_id, p_role, p_note, auth.uid(), now(),
    v_prev_status, v_prev_plan, v_prev_ends_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role       = EXCLUDED.role,
    note       = EXCLUDED.note,
    granted_by = EXCLUDED.granted_by,
    granted_at = EXCLUDED.granted_at,
    revoked_at = NULL,
    revoked_by = NULL,
    -- Conserver le snapshot original si un rôle était déjà actif
    previous_status   = CASE WHEN v_existing_active
                             THEN special_access.previous_status
                             ELSE EXCLUDED.previous_status END,
    previous_plan     = CASE WHEN v_existing_active
                             THEN special_access.previous_plan
                             ELSE EXCLUDED.previous_plan END,
    previous_ends_at  = CASE WHEN v_existing_active
                             THEN special_access.previous_ends_at
                             ELSE EXCLUDED.previous_ends_at END;

  -- 6. Mettre à jour profiles
  UPDATE profiles
  SET subscription_status = 'comped',
      subscription_plan   = NULL,
      special_role        = p_role,
      updated_at          = now()
  WHERE id = p_user_id;

  -- 7. Audit trail
  INSERT INTO subscription_events (
    user_id, event_type, previous_status, new_status, granted_by, raw_payload
  ) VALUES (
    p_user_id,
    'special_access_granted',
    v_prev_status,
    'comped',
    auth.uid(),
    jsonb_build_object(
      'role',       p_role,
      'granted_by', auth.uid()::text,
      'timestamp',  now()::text
    )
  );
END;
$$;

-- ============================================================
-- RPC 2 : revoke_special_access
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_special_access(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role     text;
  v_prev_status     text;
  v_prev_plan       text;
  v_prev_ends_at    timestamptz;
  v_restored_status text;
BEGIN
  -- 1. Vérifier admin
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Interdire l'auto-révocation
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'self_revoke_forbidden' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 2. Lire le snapshot
  SELECT previous_status, previous_plan, previous_ends_at
  INTO v_prev_status, v_prev_plan, v_prev_ends_at
  FROM special_access
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_role' USING ERRCODE = 'no_data_found';
  END IF;

  -- 3. Logique de restauration
  IF v_prev_ends_at IS NOT NULL AND v_prev_ends_at > now()
     AND v_prev_status IN ('active','trialing') THEN
    -- Abonnement Stripe encore valide → restaurer les jours restants
    v_restored_status := v_prev_status;
    UPDATE profiles
    SET subscription_status   = v_prev_status,
        subscription_plan     = v_prev_plan,
        subscription_ends_at  = v_prev_ends_at,
        special_role          = NULL,
        updated_at            = now()
    WHERE id = p_user_id;
  ELSE
    -- Pas d'abonnement ou expiré → retour à free
    v_restored_status := 'free';
    UPDATE profiles
    SET subscription_status   = 'free',
        subscription_plan     = NULL,
        subscription_ends_at  = NULL,
        special_role          = NULL,
        updated_at            = now()
    WHERE id = p_user_id;
  END IF;

  -- 4. Archiver dans special_access
  UPDATE special_access
  SET revoked_at = now(),
      revoked_by = auth.uid()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  -- 5. Audit trail
  INSERT INTO subscription_events (
    user_id, event_type, previous_status, new_status, granted_by, raw_payload
  ) VALUES (
    p_user_id,
    'special_access_revoked',
    'comped',
    v_restored_status,
    auth.uid(),
    jsonb_build_object(
      'restored_status', v_restored_status,
      'revoked_by',      auth.uid()::text,
      'timestamp',       now()::text
    )
  );
END;
$$;

-- ============================================================
-- RPC 3 : clear_special_access_note (droit d'effacement RGPD)
-- ============================================================
CREATE OR REPLACE FUNCTION public.clear_special_access_note(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE special_access SET note = NULL WHERE user_id = p_user_id;

  INSERT INTO subscription_events (
    user_id, event_type, previous_status, new_status, granted_by, raw_payload
  )
  SELECT
    p_user_id,
    'special_access_note_cleared',
    subscription_status,
    subscription_status,
    auth.uid(),
    jsonb_build_object('timestamp', now()::text)
  FROM profiles WHERE id = p_user_id;
END;
$$;

-- Permissions RPCs
REVOKE ALL ON FUNCTION public.grant_special_access(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_special_access(uuid)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_special_access_note(uuid)         FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_special_access(uuid, text, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_special_access(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_special_access_note(uuid)             TO authenticated;
