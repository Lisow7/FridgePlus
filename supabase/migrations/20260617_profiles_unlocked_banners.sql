-- Quêtes & personnalisation (PR2) — bannières débloquées via quêtes.
-- Les bannières du catalogue sont LIBRES par défaut ; seules celles désignées
-- comme récompense d'une quête (reward.banner) sont verrouillées jusqu'à
-- figurer dans ce tableau. Octroi idempotent côté app à la complétion.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlocked_banners text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.profiles.unlocked_banners IS 'Bannières débloquées via quêtes (ids du catalogue banners.js).';
