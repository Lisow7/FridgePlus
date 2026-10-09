-- ════════════════════════════════════════════════════════════════════════
-- Notifications push — Phase 1 : schéma de base
-- ════════════════════════════════════════════════════════════════════════
-- Table des abonnements push (un par couple navigateur+appareil), colonnes
-- de préférences sur profiles, et RPC d'écriture (voir commentaire sur la
-- RPC pour le raisonnement RLS).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth_key      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Abonnements Web Push (un par navigateur/appareil). endpoint est la clé d''upsert : un même appareil peut faire tourner ou réémettre le même endpoint.';

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Lecture/suppression : le propriétaire uniquement. L'Edge Function d'envoi
-- utilise la clé service_role (bypasse RLS) — pas de policy dédiée nécessaire.
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Pas de policy INSERT/UPDATE pour `authenticated` : l'écriture passe
-- exclusivement par la RPC SECURITY DEFINER ci-dessous (voir son commentaire).

-- ─── Préférences par catégorie + anti-répétition, sur profiles ─────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_preferences jsonb NOT NULL DEFAULT
    '{"inactivity_reminder": false, "announcements": false, "stock_expiry": false, "community": false}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_last_variant_index smallint;

COMMENT ON COLUMN public.profiles.push_preferences IS
  'Préférences push par catégorie (opt-in explicite). Seule inactivity_reminder est exploitée en Phase 1 ; announcements/stock_expiry/community existent dès maintenant dans le schéma pour éviter une migration future, mais ne sont lues par aucun code tant que leur chantier n''est pas fait.';

COMMENT ON COLUMN public.profiles.push_last_variant_index IS
  'Index (0-4) de la dernière variante de message de relance inactivité envoyée à ce user — anti-répétition round-robin, géré par l''Edge Function send-push-notification.';

-- ─── RPC d'abonnement (SECURITY DEFINER) ───────────────────────────────────
-- Pourquoi une RPC plutôt qu'un upsert client direct sur ON CONFLICT DO
-- UPDATE : (1) un upsert client exigerait une policy RLS UPDATE en plus de
-- SELECT/DELETE, uniquement pour ce conflit ; (2) cas de l'appareil partagé
-- — le même endpoint navigateur peut être réabonné par un compte différent
-- (déconnexion/reconnexion sur le même appareil). C'est un transfert de
-- propriété VOULU (qui est connecté sur ce navigateur doit recevoir les
-- push), pas une faille à bloquer. La RPC fixe toujours user_id = auth.uid()
-- côté serveur, sans avoir à raisonner sur le propriétaire précédent.
CREATE OR REPLACE FUNCTION public.subscribe_to_push(
  p_endpoint text,
  p_p256dh   text,
  p_auth_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'subscribe_to_push: authentication required';
  END IF;

  IF p_endpoint IS NULL OR p_endpoint = '' THEN
    RAISE EXCEPTION 'subscribe_to_push: p_endpoint is required';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth_key, last_seen_at)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth_key, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id      = auth.uid(),
    p256dh       = excluded.p256dh,
    auth_key     = excluded.auth_key,
    last_seen_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) TO authenticated;

COMMENT ON FUNCTION public.subscribe_to_push IS
  'Crée ou met à jour un abonnement push pour l''utilisateur courant (upsert sur endpoint). SECURITY DEFINER pour gérer le conflit ON CONFLICT DO UPDATE sans policy RLS UPDATE dédiée.';
