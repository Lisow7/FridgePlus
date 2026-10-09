-- Sonde des sanctions appliquées par la base (migration
-- 20261004_sanctions_appliquees_par_la_base.sql). Audit du 2026-10-04, BDD-02.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart.
--
-- Elle prend un compte ordinaire, joue chaque écriture publique « en règle »
-- (témoin : tout doit passer), puis le met en sourdine, le bannit, le marque en
-- cours de suppression — et rejoue. Un refus n'a de valeur que parce que la
-- MÊME écriture venait d'être acceptée pour le même compte.
--
-- RÉSULTATS DU 2026-10-04
-- 1. Essai à blanc AVANT application (le DDL de la migration exécuté dans le
--    même bloc, donc annulé avec lui) : 39 lignes, 0 écart. Chaque refus nomme
--    la politique qui l'a prononcé (« violates row-level security policy
--    "sanctions_insert" ») : ce sont bien les nouvelles règles qui jouent.
-- 2. APRÈS application (`20261004194413`) : 11 politiques restrictives en
--    place ; un compte en règle publie ; un compte banni et en sourdine tente
--    8 messages, 0 accepté (le matin même, avant la migration : 8 sur 8).

DO $probe$
DECLARE
  a   uuid;                      -- le compte admin
  u   uuid;                      -- un compte ordinaire
  off text;                      -- une recette officielle
  rid text := 'sonde-sanction-' || substr(md5(random()::text), 1, 8);
  p   uuid;                      -- un message de la sonde
  t   uuid;                      -- un ticket de la sonde
  r   text := '';
  msg text;
  rep text;
  reac text;                     -- réagir à un message
  avis text;                     -- donner un avis sur une recette
  tic text;
  tmsg text;
  rec text;
  pan text;
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND COALESCE(banned, false) = false AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;
  SELECT id INTO off FROM public.recipes_unified WHERE origin = 'official' ORDER BY id LIMIT 1;
  IF a IS NULL OR u IS NULL OR off IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin, un compte ordinaire et une recette officielle';
  END IF;

  -- Joue une écriture et rend une ligne de rapport. `attendu` est le DÉBUT du
  -- résultat espéré (« ACCEPTÉ », « REFUSÉ 42501 »).
  CREATE FUNCTION public.__sonde_ligne(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q;
      obtenu := 'ACCEPTÉ';
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 80);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN obtenu LIKE attendu || '%' THEN '' ELSE ' ⚠' END;
  END
  $f$;

  -- (Pour un essai à blanc AVANT d'appliquer une migration, exécuter son DDL ici
  -- par `EXECUTE` : il sera annulé avec le reste.)

  -- Les écritures rejouées à chaque état du compte.
  msg  := format('INSERT INTO public.community_posts (user_id, category, title, body) VALUES (%L, ''general'', ''Sonde'', ''Message de la sonde.'')', u);
  avis := format('INSERT INTO public.engagement (user_id, type, target_recipe_id, rating, body) VALUES (%L, ''review'', %L, 4, %L)', u, off, rid);
  tic  := format('INSERT INTO public.support_tickets (user_id, type, title) VALUES (%L, ''question'', %L)', u, rid);
  rec  := format('INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote, admin_modified, moderation_reason) VALUES (%L || ''-'' || substr(md5(random()::text), 1, 6), %L, ''Sonde'', ''{"name":"Sonde","emoji":"🍳"}''::jsonb, ''private'', false, false, false, NULL)', rid, u);
  pan  := format('INSERT INTO public.shared_baskets (user_id, payload) VALUES (%L, ''{}''::jsonb)', u);

  ---------------------------------------------------------------------------
  -- 1. Compte en règle : tout passe (témoin)
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.community_posts (user_id, category, title, body)
  VALUES (u, 'general', 'Sonde', 'Premier message de la sonde.') RETURNING id INTO p;
  r := r || E'\n1.1 compte en règle : publier un message — attendu ACCEPTÉ : ACCEPTÉ';
  rep  := format('INSERT INTO public.community_replies (post_id, user_id, body) VALUES (%L, %L, ''Réponse de la sonde.'')', p, u);
  reac := format('INSERT INTO public.engagement (user_id, type, target_post_id, emoji) VALUES (%L, ''reaction'', %L, ''👍'')', u, p);

  r := r || public.__sonde_ligne('1.2 compte en règle : répondre', 'ACCEPTÉ', rep);
  r := r || public.__sonde_ligne('1.3 compte en règle : réagir à un message', 'ACCEPTÉ', reac);
  r := r || public.__sonde_ligne('1.4 compte en règle : donner un avis sur une recette', 'ACCEPTÉ', avis);
  INSERT INTO public.support_tickets (user_id, type, title) VALUES (u, 'question', rid) RETURNING id INTO t;
  r := r || E'\n1.5 compte en règle : ouvrir un ticket — attendu ACCEPTÉ : ACCEPTÉ';
  tmsg := format('INSERT INTO public.support_messages (ticket_id, sender_id, content) VALUES (%L, %L, ''Message de la sonde.'')', t, u);
  r := r || public.__sonde_ligne('1.6 compte en règle : écrire dans son ticket', 'ACCEPTÉ', tmsg);
  r := r || public.__sonde_ligne('1.7 compte en règle : créer une recette', 'ACCEPTÉ', rec);
  r := r || public.__sonde_ligne('1.8 compte en règle : créer un lien de panier partagé', 'ACCEPTÉ', pan);
  r := r || public.__sonde_ligne('1.9 compte en règle : modifier son message', 'ACCEPTÉ', format('UPDATE public.community_posts SET title = ''Sonde (modifiée)'' WHERE id = %L', p));

  -- Quota : 5 messages par jour (le premier est déjà compté).
  r := r || public.__sonde_ligne('1.10 quota : 2e message du jour', 'ACCEPTÉ', msg);
  r := r || public.__sonde_ligne('1.11 quota : 3e message du jour', 'ACCEPTÉ', msg);
  r := r || public.__sonde_ligne('1.12 quota : 4e message du jour', 'ACCEPTÉ', msg);
  r := r || public.__sonde_ligne('1.13 quota : 5e message du jour', 'ACCEPTÉ', msg);
  r := r || public.__sonde_ligne('1.14 quota : 6e message du jour', 'REFUSÉ 42501', msg);

  ---------------------------------------------------------------------------
  -- 2. Compte en sourdine
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  -- Les messages de quota sont retirés pour que seul la sourdine joue.
  DELETE FROM public.community_posts WHERE user_id = u AND id <> p AND body = 'Message de la sonde.';
  UPDATE public.profiles SET community_muted_until = now() + interval '1 day' WHERE id = u;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  r := r || public.__sonde_ligne('2.1 en sourdine : publier un message', 'REFUSÉ 42501', msg);
  r := r || public.__sonde_ligne('2.2 en sourdine : répondre', 'REFUSÉ 42501', rep);
  r := r || public.__sonde_ligne('2.3 en sourdine : modifier son message', 'REFUSÉ 42501', format('UPDATE public.community_posts SET title = ''Sonde (remodifiée)'' WHERE id = %L', p));
  r := r || public.__sonde_ligne('2.4 en sourdine : donner un avis (la sourdine ne porte pas dessus)', 'ACCEPTÉ', format('UPDATE public.engagement SET rating = 5 WHERE user_id = %L AND body = %L', u, rid));
  r := r || public.__sonde_ligne('2.5 en sourdine : retirer son message', 'ACCEPTÉ', format('UPDATE public.community_posts SET deleted_at = now() WHERE id = %L', p));
  r := r || public.__sonde_ligne('2.6 en sourdine : rétablir son message', 'REFUSÉ 42501', format('UPDATE public.community_posts SET deleted_at = NULL WHERE id = %L', p));

  ---------------------------------------------------------------------------
  -- 3. Compte banni (sourdine levée)
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET community_muted_until = NULL, banned = true WHERE id = u;
  UPDATE public.community_posts SET deleted_at = NULL WHERE id = p;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  r := r || public.__sonde_ligne('3.1 banni : publier un message', 'REFUSÉ 42501', msg);
  r := r || public.__sonde_ligne('3.2 banni : répondre', 'REFUSÉ 42501', rep);
  r := r || public.__sonde_ligne('3.3 banni : réagir', 'REFUSÉ 42501', format('INSERT INTO public.engagement (user_id, type, target_post_id) VALUES (%L, ''post_like'', %L)', u, p));
  r := r || public.__sonde_ligne('3.4 banni : donner un avis', 'REFUSÉ 42501', avis);
  r := r || public.__sonde_ligne('3.5 banni : ouvrir un ticket', 'REFUSÉ 42501', tic);
  r := r || public.__sonde_ligne('3.6 banni : écrire dans son ticket', 'REFUSÉ 42501', tmsg);
  r := r || public.__sonde_ligne('3.7 banni : créer une recette', 'REFUSÉ 42501', rec);
  r := r || public.__sonde_ligne('3.8 banni : créer un lien de panier partagé', 'REFUSÉ 42501', pan);
  r := r || public.__sonde_ligne('3.9 banni : modifier son message', 'REFUSÉ 42501', format('UPDATE public.community_posts SET title = ''Sonde (banni)'' WHERE id = %L', p));
  r := r || public.__sonde_ligne('3.10 banni : retirer son message', 'ACCEPTÉ', format('UPDATE public.community_posts SET deleted_at = now() WHERE id = %L', p));

  ---------------------------------------------------------------------------
  -- 4. Compte en cours de suppression (ni banni ni en sourdine)
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET banned = false, deleted_at = now() WHERE id = u;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  r := r || public.__sonde_ligne('4.1 suppression en cours : publier un message', 'REFUSÉ 42501', msg);
  r := r || public.__sonde_ligne('4.2 suppression en cours : créer une recette', 'REFUSÉ 42501', rec);

  ---------------------------------------------------------------------------
  -- 5. L'admin n'est jamais gêné, quota compris
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  msg := format('INSERT INTO public.community_posts (user_id, category, title, body) VALUES (%L, ''general'', ''Sonde admin'', ''Message de la sonde.'')', a);
  FOR i IN 1..6 LOOP
    r := r || public.__sonde_ligne('5.' || i || ' admin : message n° ' || i || ' du jour', 'ACCEPTÉ', msg);
  END LOOP;
  r := r || public.__sonde_ligne('5.7 admin : répondre dans le ticket du compte', 'ACCEPTÉ', format('INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content) VALUES (%L, %L, true, ''Réponse de la sonde.'')', t, a));

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;
