-- Droits en base resserrés (audit du 2026-10-04, constats hors lots — tri et
-- vérification en base du 2026-10-08) :
--
-- BDD-16 — `admin_delete_notification_batch(uuid)` (SECURITY DEFINER, créée le
--   08/07) restait exécutable par `anon`, comme toute fonction neuve de `public`
--   (droits par défaut). Son corps vérifie `is_admin()`, mais un visiteur n'a
--   rien à y faire. `authenticated` garde le droit : le panneau admin l'appelle
--   (src/features/notifications/api/notifications.js), la prod v0.145 aussi.
--
-- BDD-18 (4) — `feature_flags.updated_by` (l'identifiant de l'admin qui a
--   basculé) était lisible par n'importe quel visiteur. L'application ne lit
--   que key, enabled, label, description (prod v0.145 et dev) ; l'écriture de
--   l'admin filtre sur `key` et ne relit que `key`. La lecture passe colonne par
--   colonne ; les autres droits ne changent pas (la RLS borne les écritures à
--   l'admin).
--
-- BDD-21 (4) — `ai_cache` était lisible par `anon` et `authenticated` (la
--   politique ne rendait que les lignes `substitute`). Aucune lecture côté
--   client, ni en prod ni en dev : seules les fonctions edge la lisent, avec
--   `service_role`.
--
-- Hors de ce fichier : les droits d'anon/authenticated sur le schéma `net`
-- (pg_net) — exploitable seulement si l'API expose `net`, réglage du tableau de
-- bord qu'Antoine doit lire d'abord (voir le SUIVI).

REVOKE EXECUTE ON FUNCTION public.admin_delete_notification_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_notification_batch(uuid) TO authenticated, service_role;

REVOKE SELECT ON public.feature_flags FROM anon, authenticated;
GRANT SELECT (key, enabled, label, description, updated_at) ON public.feature_flags TO anon, authenticated;

REVOKE SELECT ON public.ai_cache FROM anon, authenticated;
