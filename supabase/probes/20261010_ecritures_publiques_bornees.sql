-- Sonde de la migration 20261010070000_ecritures_publiques_bornees.sql : un
-- panier partagé se lit par sa fonction (un seul, celui du lien), ses dates et
-- son nombre sont bornés par la base, une adresse de push doit être celle d'un
-- service connu, une seule règle de suppression des notifications, plus de
-- règle morte sur le cache IA, l'accès spécial ne bloque plus l'effacement de
-- l'admin, et une fonction neuve n'est plus exécutable par défaut.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit — même l'essai à blanc du DDL et
-- les paniers de la sonde sont annulés. Le « message d'erreur » est le rapport ;
-- une ligne « ⚠ » est un écart. Elle prend un compte ordinaire au hasard et
-- n'affiche aucune donnée personnelle.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  u uuid;
  n int;
  v text;
  id_panier uuid;
  lu jsonb;
BEGIN
  -- ── A. Avant ───────────────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_baskets' AND policyname = 'shared_baskets_public_read';
  r := r || E'\nA1 lecture publique de la table avant — attendu 1 (elle tombe après la release) : ' || n;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.proname = 'get_shared_basket';
  r := r || E'\nA2 get_shared_basket avant — attendu 0 : ' || n || CASE WHEN n = 0 THEN '' ELSE ' (déjà appliquée)' END;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'DELETE';
  r := r || E'\nA3 règles DELETE sur notifications avant — attendu 2 : ' || n;

  -- ── ESSAI À BLANC : la migration, annulée avec tout le reste ─────────────────
  CREATE OR REPLACE FUNCTION public.get_shared_basket(p_id uuid)
  RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $f$
    SELECT jsonb_build_object('payload', b.payload, 'expires_at', b.expires_at)
      FROM public.shared_baskets b WHERE b.id = p_id AND b.expires_at > now();
  $f$;
  REVOKE EXECUTE ON FUNCTION public.get_shared_basket(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_shared_basket(uuid) TO anon, authenticated, service_role;
  DROP POLICY IF EXISTS shared_baskets_owner_select ON public.shared_baskets;
  CREATE POLICY shared_baskets_owner_select ON public.shared_baskets AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
  CREATE OR REPLACE FUNCTION public.shared_baskets_borne() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
  DECLARE actifs integer;
  BEGIN
    NEW.created_at := now();
    NEW.expires_at := LEAST(coalesce(NEW.expires_at, now() + interval '7 days'), now() + interval '30 days');
    IF NEW.expires_at <= now() THEN RAISE EXCEPTION 'shared_baskets: la date d''expiration est déjà passée' USING ERRCODE = 'check_violation'; END IF;
    SELECT count(*) INTO actifs FROM public.shared_baskets WHERE user_id = NEW.user_id AND expires_at > now();
    IF actifs >= 20 THEN RAISE EXCEPTION 'shared_baskets: 20 paniers partagés actifs au plus par compte' USING ERRCODE = 'check_violation'; END IF;
    RETURN NEW;
  END; $f$;
  REVOKE EXECUTE ON FUNCTION public.shared_baskets_borne() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.shared_baskets_borne() TO anon, authenticated, service_role;
  DROP TRIGGER IF EXISTS shared_baskets_borne ON public.shared_baskets;
  CREATE TRIGGER shared_baskets_borne BEFORE INSERT ON public.shared_baskets FOR EACH ROW EXECUTE FUNCTION public.shared_baskets_borne();
  CREATE OR REPLACE FUNCTION public.subscribe_to_push(p_endpoint text, p_p256dh text, p_auth_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
  DECLARE hote text; appareils integer;
  BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'subscribe_to_push: authentication required'; END IF;
    IF p_endpoint IS NULL OR p_endpoint = '' THEN RAISE EXCEPTION 'subscribe_to_push: p_endpoint is required'; END IF;
    hote := lower(substring(p_endpoint from '^https://([^/?#]+)'));
    IF hote IS NULL OR NOT (hote = 'fcm.googleapis.com' OR hote = 'updates.push.services.mozilla.com' OR hote LIKE '%.notify.windows.com' OR hote = 'web.push.apple.com' OR hote LIKE '%.push.samsungosp.com') THEN
      RAISE EXCEPTION 'subscribe_to_push: endpoint hors des services de push connus' USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO appareils FROM public.push_subscriptions WHERE user_id = auth.uid() AND endpoint <> p_endpoint;
    IF appareils >= 10 THEN RAISE EXCEPTION 'subscribe_to_push: 10 appareils abonnés au plus par compte' USING ERRCODE = 'check_violation'; END IF;
    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth_key, last_seen_at) VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth_key, now())
    ON CONFLICT (endpoint) DO UPDATE SET user_id = auth.uid(), p256dh = excluded.p256dh, auth_key = excluded.auth_key, last_seen_at = now();
  END; $f$;
  REVOKE EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.subscribe_to_push(text, text, text) TO authenticated, service_role;
  DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
  DROP POLICY IF EXISTS notifications_delete_admin_broadcast ON public.notifications;
  CREATE POLICY notifications_delete ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated
    USING (recipient_id = (select auth.uid()) OR (recipient_id IS NULL AND recipient_role = 'admin' AND public.is_admin()));
  DROP POLICY IF EXISTS ai_cache_public_select ON public.ai_cache;
  ALTER TABLE public.special_access ALTER COLUMN granted_by DROP NOT NULL;
  ALTER TABLE public.special_access DROP CONSTRAINT IF EXISTS special_access_granted_by_fkey;
  ALTER TABLE public.special_access ADD CONSTRAINT special_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

  -- ── B. Structure après l'essai ──────────────────────────────────────────────
  r := r || E'\nB1 get_shared_basket : définisseur / visiteur peut / PUBLIC peut — attendu true/true/false : '
    || (SELECT p.prosecdef::text FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.proname = 'get_shared_basket') || '/'
    || has_function_privilege('anon', 'public.get_shared_basket(uuid)', 'EXECUTE')::text || '/'
    || coalesce((SELECT bool_or(a.grantee = 0) FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.get_shared_basket(uuid)'::regprocedure AND a.privilege_type = 'EXECUTE'), false)::text;
  SELECT count(*) INTO n FROM pg_trigger WHERE tgrelid = 'public.shared_baskets'::regclass AND tgname = 'shared_baskets_borne';
  r := r || E'\nB2 déclencheur shared_baskets_borne — attendu 1 : ' || n;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND cmd = 'DELETE';
  r := r || E'\nB3 règles DELETE sur notifications — attendu 1 : ' || n;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_cache' AND policyname = 'ai_cache_public_select';
  r := r || E'\nB4 ai_cache_public_select — attendu 0 : ' || n;
  SELECT is_nullable || '/' || (SELECT confdeltype FROM pg_constraint WHERE conname = 'special_access_granted_by_fkey') INTO v
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'special_access' AND column_name = 'granted_by';
  r := r || E'\nB5 special_access.granted_by : nullable / suppression — attendu YES/n (SET NULL) : ' || v;
  SELECT coalesce((SELECT defaclacl::text FROM pg_default_acl WHERE defaclrole = 'postgres'::regrole AND defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'f'), 'ABSENT') INTO v;
  r := r || E'\nB6 droits par défaut des fonctions neuves (postgres, public) — attendu sans anon ni authenticated : '
    || CASE WHEN v LIKE '%anon=%' OR v LIKE '%authenticated=%' THEN 'encore ouverts ⚠' ELSE 'fermés' END;
  r := r || E'\nB7 subscribe_to_push : visiteur peut / compte peut — attendu false/true : '
    || has_function_privilege('anon', 'public.subscribe_to_push(text, text, text)', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.subscribe_to_push(text, text, text)', 'EXECUTE')::text;

  -- ── C. Comportement, sous un compte ordinaire pris au hasard ──────────────────
  SELECT p.id INTO u FROM public.profiles p WHERE p.role IS DISTINCT FROM 'admin' AND p.deleted_at IS NULL ORDER BY random() LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.shared_baskets (user_id, payload, expires_at, created_at)
  VALUES (u, '{"rows":[],"total":0,"lang":"fr"}'::jsonb, now() + interval '400 days', '2000-01-01')
  RETURNING id INTO id_panier;
  SELECT (expires_at <= now() + interval '30 days' + interval '1 minute')::text || '/' || (created_at >= now() - interval '1 minute')::text INTO v
    FROM public.shared_baskets WHERE id = id_panier;
  r := r || E'\nC1 un panier demandé pour 400 jours, daté de 2000 — attendu true/true (30 jours au plus, daté par la base) : ' || v;

  BEGIN
    FOR n IN 1..19 LOOP
      INSERT INTO public.shared_baskets (user_id, payload) VALUES (u, '{"rows":[],"total":0,"lang":"fr"}'::jsonb);
    END LOOP;
    r := r || E'\nC2 vingt paniers actifs — attendu acceptés : acceptés';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nC2 vingt paniers actifs — attendu acceptés : REFUSÉS ⚠ ' || left(SQLERRM, 80);
  END;
  BEGIN
    INSERT INTO public.shared_baskets (user_id, payload) VALUES (u, '{"rows":[],"total":0,"lang":"fr"}'::jsonb);
    r := r || E'\nC3 le vingt-et-unième — attendu refusé (check_violation) : ACCEPTÉ ⚠';
  EXCEPTION WHEN check_violation THEN
    r := r || E'\nC3 le vingt-et-unième — attendu refusé (check_violation) : refusé';
  END;

  BEGIN
    PERFORM public.subscribe_to_push('https://attaquant.example/relais', 'k', 'a');
    r := r || E'\nC4 push vers un hôte inconnu — attendu refusé (check_violation) : ACCEPTÉ ⚠';
  EXCEPTION WHEN check_violation THEN
    r := r || E'\nC4 push vers un hôte inconnu — attendu refusé (check_violation) : refusé';
  END;
  BEGIN
    PERFORM public.subscribe_to_push('https://fcm.googleapis.com/fcm/send/sonde-' || gen_random_uuid()::text, 'k', 'a');
    r := r || E'\nC5 push vers fcm.googleapis.com — attendu accepté : accepté';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nC5 push vers fcm.googleapis.com — attendu accepté : REFUSÉ ⚠ ' || left(SQLERRM, 80);
  END;

  -- Un visiteur lit le panier du lien par la fonction, et rien d'autre.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  SELECT public.get_shared_basket(id_panier) INTO lu;
  r := r || E'\nC6 visiteur, le panier du lien par la fonction — attendu lang fr : ' || coalesce(lu -> 'payload' ->> 'lang', 'RIEN ⚠');
  SELECT public.get_shared_basket(gen_random_uuid()) INTO lu;
  r := r || E'\nC7 visiteur, un lien inconnu — attendu rien : ' || CASE WHEN lu IS NULL THEN 'rien' ELSE 'quelque chose ⚠' END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE EXCEPTION 'SONDE ecritures_publiques_bornees (rien n''est écrit) :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).
