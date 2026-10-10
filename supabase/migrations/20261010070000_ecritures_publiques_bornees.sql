-- Écritures publiques bornées (audit du 2026-10-04 : BDD-05 (1, 3, 4), BDD-15,
-- BDD-16 (1), BDD-21 (1, 4, 5) ; décision du 2026-10-08 pour
-- `special_access.granted_by`).
--
-- Ce que n'importe qui pouvait faire en base, sans limite, vérifié le 10/10 :
--   1. lire TOUTE la table des paniers partagés — la règle de lecture publique
--      ne filtrait que sur la date : chaque panier, avec l'identifiant de son
--      compte, pour qui sait demander `select *` ;
--   2. poser une date d'expiration en l'an 9999 (la purge n° 5 ne prend que
--      `expires_at < now()`) et empiler des paniers sans fin (64 Ko chacun) ;
--   3. enregistrer comme adresse de push n'importe quelle URL — les fonctions
--      d'envoi y postent ensuite —, autant de fois qu'on veut ;
--   4. et toute fonction neuve du schéma public naissait exécutable par les
--      visiteurs (droits par défaut du projet : `admin_delete_notification_batch`
--      l'est restée trois mois) ; deux règles de suppression des notifications
--      se doublaient (advisor `multiple_permissive_policies`) ; une règle de
--      lecture du cache IA survivait sans lecteur (la lecture a été retirée à
--      anon et authenticated le 10/10) ; un accès spécial bloquait l'effacement
--      dur de l'admin qui l'avait accordé (ON DELETE RESTRICT).
--
-- Compatible avec la v0.145 en production : la règle de lecture publique des
-- paniers reste jusqu'à la release (seconde moitié :
-- `paniers_partages_lecture_par_rpc_apres_release`), le client de `dev` lit déjà
-- par la fonction. Attend la confirmation d'Antoine : essai à blanc par la sonde
-- supabase/probes/20261010_ecritures_publiques_bornees.sql, puis `apply_migration`,
-- puis renommer le fichier à la version inscrite.

-- ── 1. Paniers partagés : lecture par fonction, un seul panier — celui du lien ──
-- L'identifiant (UUID v4) est la clé du lien ; la fonction ne rend que le
-- panier demandé, et seulement s'il n'a pas expiré. Rien d'autre de la table
-- ne sort : ni la liste, ni les comptes.
CREATE OR REPLACE FUNCTION public.get_shared_basket(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('payload', b.payload, 'expires_at', b.expires_at)
    FROM public.shared_baskets b
   WHERE b.id = p_id AND b.expires_at > now();
$$;
REVOKE EXECUTE ON FUNCTION public.get_shared_basket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_basket(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_shared_basket(uuid) IS
  'Un panier partagé par son lien (payload, expires_at), ou NULL s''il n''existe pas ou a expiré — la seule lecture publique de shared_baskets (audit 2026-10-04, BDD-05).';

-- Le propriétaire lit SES paniers (export de ses données), aujourd'hui et le jour
-- où la lecture publique de la table tombe.
DROP POLICY IF EXISTS shared_baskets_owner_select ON public.shared_baskets;
CREATE POLICY shared_baskets_owner_select ON public.shared_baskets
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ── 2. Bornes à l'insertion : date posée par la base, 30 jours au plus, 20 actifs ──
-- Le client proposait `expires_at` et `created_at` librement ; la base les pose.
-- Sous droits du définisseur pour compter les paniers du compte sans dépendre
-- des règles de lecture ; exécutable par les rôles qui insèrent (un déclencheur
-- ne s'appelle pas à la main : « trigger functions can only be called as triggers »).
CREATE OR REPLACE FUNCTION public.shared_baskets_borne()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actifs integer;
BEGIN
  NEW.created_at := now();
  NEW.expires_at := LEAST(coalesce(NEW.expires_at, now() + interval '7 days'), now() + interval '30 days');
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'shared_baskets: la date d''expiration est déjà passée' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO actifs FROM public.shared_baskets
   WHERE user_id = NEW.user_id AND expires_at > now();
  IF actifs >= 20 THEN
    RAISE EXCEPTION 'shared_baskets: 20 paniers partagés actifs au plus par compte' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.shared_baskets_borne() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shared_baskets_borne() TO anon, authenticated, service_role;
DROP TRIGGER IF EXISTS shared_baskets_borne ON public.shared_baskets;
CREATE TRIGGER shared_baskets_borne
  BEFORE INSERT ON public.shared_baskets
  FOR EACH ROW EXECUTE FUNCTION public.shared_baskets_borne();

-- ── 3. Abonnements push : l'adresse d'un service de push connu, dix appareils ──
-- Les fonctions d'envoi postent à `endpoint` tel quel : une adresse libre, c'est
-- un relais vers n'importe quel serveur (BDD-15). Les hôtes admis sont ceux des
-- navigateurs qui savent recevoir du push web.
CREATE OR REPLACE FUNCTION public.subscribe_to_push(p_endpoint text, p_p256dh text, p_auth_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hote text;
  appareils integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'subscribe_to_push: authentication required';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint = '' THEN
    RAISE EXCEPTION 'subscribe_to_push: p_endpoint is required';
  END IF;

  hote := lower(substring(p_endpoint from '^https://([^/?#]+)'));
  IF hote IS NULL OR NOT (
       hote = 'fcm.googleapis.com'                  -- Chrome, Edge, Opera, Brave, Vivaldi, Android
    OR hote = 'updates.push.services.mozilla.com'   -- Firefox
    OR hote LIKE '%.notify.windows.com'             -- Edge (WNS)
    OR hote = 'web.push.apple.com'                  -- Safari
    OR hote LIKE '%.push.samsungosp.com'            -- Samsung Internet
  ) THEN
    RAISE EXCEPTION 'subscribe_to_push: endpoint hors des services de push connus' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO appareils FROM public.push_subscriptions
   WHERE user_id = auth.uid() AND endpoint <> p_endpoint;
  IF appareils >= 10 THEN
    RAISE EXCEPTION 'subscribe_to_push: 10 appareils abonnés au plus par compte' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth_key, last_seen_at)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth_key, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id      = auth.uid(),
    p256dh       = excluded.p256dh,
    auth_key     = excluded.auth_key,
    last_seen_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) TO authenticated, service_role;

-- ── 4. Notifications : une seule règle de suppression (BDD-21 (1)) ───────────
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_admin_broadcast ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    recipient_id = (select auth.uid())
    OR (recipient_id IS NULL AND recipient_role = 'admin' AND public.is_admin())
  );

-- ── 5. Cache IA : la règle de lecture publique n'a plus de lecteur (BDD-21 (4)) ──
-- La lecture de la table a été retirée à anon et authenticated le 2026-10-10
-- (`droits_en_base`) ; seules les fonctions edge la lisent, avec service_role,
-- qui ne passe pas par les règles.
DROP POLICY IF EXISTS ai_cache_public_select ON public.ai_cache;

-- ── 6. Accès spécial : l'admin qui l'a accordé peut être effacé ───────────────
ALTER TABLE public.special_access ALTER COLUMN granted_by DROP NOT NULL;
ALTER TABLE public.special_access DROP CONSTRAINT IF EXISTS special_access_granted_by_fkey;
ALTER TABLE public.special_access
  ADD CONSTRAINT special_access_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 7. Droits par défaut : une fonction neuve dit à qui elle s'ouvre (BDD-16 (1)) ──
-- Les objets des migrations appartiennent à `postgres` ; ses droits par défaut
-- donnaient EXECUTE à anon, authenticated et service_role sur chaque fonction
-- neuve de `public`. Désormais une migration accorde EXECUTE explicitement
-- (service_role le garde par défaut) ; le garde-fou `fonctions-definer-bornees`
-- l'exige pour toute fonction SECURITY DEFINER. Les fonctions existantes ne
-- changent pas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
