-- v3.127.0 — Partage panier public (URL temporaire)
--
-- Table `shared_baskets` : snapshot de panier accessible publiquement via un UUID.
-- Durée de vie : 7 jours (expires_at). Le payload ne contient aucune PII —
-- uniquement les ingrédients consolidés avec leurs quantités et prix estimés.
--
-- Sécurité :
--   - SELECT : public (pas d'auth) — quiconque avec l'UUID peut lire
--   - INSERT/DELETE : propriétaire uniquement
--   - pg_cron purge les lignes expirées quotidiennement
--
-- RGPD : aucune donnée personnelle dans le payload. CASCADE DELETE depuis profiles.

CREATE TABLE IF NOT EXISTS public.shared_baskets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}',
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index pour les purges et les lookups d'expiration
CREATE INDEX IF NOT EXISTS shared_baskets_expires_at_idx
  ON public.shared_baskets(expires_at);

-- Index pour les lookups par user (liste de ses paniers partagés)
CREATE INDEX IF NOT EXISTS shared_baskets_user_id_idx
  ON public.shared_baskets(user_id);

-- RLS
ALTER TABLE public.shared_baskets ENABLE ROW LEVEL SECURITY;

-- Lecture publique (nécessaire pour les visiteurs sans compte)
DROP POLICY IF EXISTS "shared_baskets_public_read" ON public.shared_baskets;
CREATE POLICY "shared_baskets_public_read"
  ON public.shared_baskets
  FOR SELECT
  USING (expires_at > now());

-- Création : utilisateur authentifié uniquement
DROP POLICY IF EXISTS "shared_baskets_owner_insert" ON public.shared_baskets;
CREATE POLICY "shared_baskets_owner_insert"
  ON public.shared_baskets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Suppression : propriétaire uniquement
DROP POLICY IF EXISTS "shared_baskets_owner_delete" ON public.shared_baskets;
CREATE POLICY "shared_baskets_owner_delete"
  ON public.shared_baskets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Purge automatique des paniers expirés (pg_cron — à activer manuellement)
-- Si pg_cron est disponible, exécuter dans le SQL Editor :
--   SELECT cron.schedule('purge-shared-baskets','0 3 * * *',$$DELETE FROM public.shared_baskets WHERE expires_at < now()$$);
-- Sans pg_cron : la politique RLS "expires_at > now()" filtre déjà les expirés à la lecture.
