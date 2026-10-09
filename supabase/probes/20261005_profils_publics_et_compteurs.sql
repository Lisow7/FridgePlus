-- Sonde des profils publics et des compteurs de la communauté (migration
-- 20261005_profils_publics_et_compteurs.sql). Audit du 2026-10-04 : BDD-13.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau d'un compte ordinaire, d'un visiteur et de l'auteur d'un post
-- créé par la sonde : lire le nom d'un autre compte, chercher un compte à
-- signaler, réagir, répondre, aimer une réponse, retirer sa réponse — et
-- regarder les compteurs et la date de modification du post.
--
-- Essai à blanc : coller le corps de la migration (sans BEGIN / COMMIT) à la
-- place de la ligne « [essai à blanc …] » ci-dessous.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  a   uuid;                      -- le compte admin
  u   uuid;                      -- un lecteur ordinaire
  o   uuid;                      -- un autre compte ordinaire, auteur du post de la sonde
  d   uuid;                      -- un compte que la sonde marque supprimé
  n   uuid;                      -- un compte qui n'a rien publié de visible
  pseudo_a text;
  pseudo_o text;
  pseudo_n text;
  p   uuid;                      -- le post de la sonde (auteur : o)
  rep uuid;                      -- la réponse de la sonde (auteur : u)
  rid text;                      -- une recette publiée (section F)
  p2  uuid;                      -- un second post, supprimé pour de bon (section F)
  rep2 uuid;
  rep3 uuid;
  r   text := '';
BEGIN
  SELECT id, username INTO a, pseudo_a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL
     AND (community_muted_until IS NULL OR community_muted_until <= now())
   ORDER BY created_at LIMIT 1;
  SELECT id, username INTO o, pseudo_o FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL AND id <> u
     AND (community_muted_until IS NULL OR community_muted_until <= now())
   ORDER BY created_at LIMIT 1;
  SELECT id INTO d FROM public.profiles
   WHERE role = 'user' AND deleted_at IS NULL AND id NOT IN (u, o) ORDER BY created_at LIMIT 1;
  SELECT pr.id, pr.username INTO n, pseudo_n FROM public.profiles pr
   WHERE pr.role = 'user' AND pr.deleted_at IS NULL AND pr.id NOT IN (u, o, d)
     AND NOT EXISTS (SELECT 1 FROM public.community_posts x WHERE x.user_id = pr.id AND x.deleted_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.community_replies x WHERE x.user_id = pr.id AND x.deleted_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.engagement x WHERE x.user_id = pr.id AND x.type = 'review' AND x.deleted_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.recipes_unified x WHERE x.user_id = pr.id AND x.status = 'published' AND x.deleted_at IS NULL)
   ORDER BY pr.created_at LIMIT 1;
  IF a IS NULL OR u IS NULL OR o IS NULL OR d IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin et trois comptes ordinaires (ni bannis, ni en sourdine)';
  END IF;

  CREATE FUNCTION public.__sonde_ligne(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q;
      obtenu := 'ACCEPTÉ';
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  CREATE FUNCTION public.__sonde_valeur(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q INTO obtenu;
      obtenu := coalesce(obtenu, 'NULL');
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN obtenu = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  GRANT EXECUTE ON FUNCTION public.__sonde_ligne(text, text, text), public.__sonde_valeur(text, text, text) TO anon, authenticated;

  -- [essai à blanc : le corps de la migration se colle ici]

  -- Le post de la sonde, écrit en propriétaire (hors règles) : o a désormais
  -- une publication visible, et la date de modification est un repère connu.
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.community_posts (user_id, category, title, body, created_at, updated_at)
  VALUES (o, 'general', 'Sonde', 'Post de la sonde', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  RETURNING id INTO p;

  ---------------------------------------------------------------------------
  -- A. Lire le nom d'un autre compte
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('A1 la table des profils reste fermée aux autres comptes (règle inchangée)', '0',
    format('SELECT count(*)::text FROM public.profiles WHERE id = %L', o));
  r := r || public.__sonde_valeur('A2 get_public_profiles rend le pseudo d''un autre compte', pseudo_o,
    format('SELECT username FROM public.get_public_profiles(ARRAY[%L]::uuid[])', o));
  RESET ROLE;
  r := r || public.__sonde_valeur('A3 … et seulement ces six colonnes',
    'TABLE(id uuid, username text, avatar_id text, banner_id text, community_bio text, created_at timestamp with time zone)',
    'SELECT pg_get_function_result(''public.get_public_profiles(uuid[])''::regprocedure)');
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET deleted_at = now() WHERE id = d;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('A4 un compte supprimé n''est pas rendu', '0',
    format('SELECT count(*)::text FROM public.get_public_profiles(ARRAY[%L]::uuid[])', d));
  r := r || public.__sonde_valeur('A5 au-delà de 200 identifiants, le reste est ignoré', '0',
    format('SELECT count(*)::text FROM public.get_public_profiles((SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 200)) || ARRAY[%L]::uuid[])', o));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.profiles SET deleted_at = NULL WHERE id = d;
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_valeur('A6 un visiteur lit le nom d''un auteur (le fil est public)', '1',
    format('SELECT count(*)::text FROM public.get_public_profiles(ARRAY[%L]::uuid[])', o));

  ---------------------------------------------------------------------------
  -- B. Chercher un compte à signaler (support)
  ---------------------------------------------------------------------------
  r := r || public.__sonde_ligne('B1 un visiteur ne cherche pas', 'REFUSÉ 42501', 'SELECT public.search_public_profiles(''abc'')');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('B2 un compte trouve l''auteur d''un post par son pseudo', '1',
    format('SELECT count(*)::text FROM public.search_public_profiles(%L) WHERE id = %L', pseudo_o, o));
  r := r || public.__sonde_valeur('B3 une seule lettre : rien', '0', 'SELECT count(*)::text FROM public.search_public_profiles(''a'')');
  r := r || public.__sonde_valeur('B4 l''admin n''est jamais proposé', '0',
    format('SELECT count(*)::text FROM public.search_public_profiles(%L) WHERE id = %L', coalesce(pseudo_a, 'xx'), a));
  r := r || public.__sonde_valeur('B5 « %% » est cherché tel quel, pas comme un joker', '0', 'SELECT count(*)::text FROM public.search_public_profiles(''%%'')');
  IF n IS NOT NULL THEN
    r := r || public.__sonde_valeur('B6 un compte qui n''a rien publié n''est pas proposé', '0',
      format('SELECT count(*)::text FROM public.search_public_profiles(%L) WHERE id = %L', pseudo_n, n));
  ELSE
    r := r || E'\nB6 sautée : aucun compte sans publication';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_valeur('B7 on ne se trouve pas soi-même', '0',
    format('SELECT count(*)::text FROM public.search_public_profiles(%L) WHERE id = %L', pseudo_o, o));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- C. Les compteurs, et la date de modification du post
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 un autre compte réagit au post', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_post_id, emoji) VALUES (%L, ''reaction'', %L, ''👍'')', u, p));
  RESET ROLE;
  r := r || public.__sonde_valeur('C2 … le compteur du post compte la réaction', '1', format('SELECT likes_count::text FROM public.community_posts WHERE id = %L', p));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C3 il répond au post', 'ACCEPTÉ',
    format('INSERT INTO public.community_replies (post_id, user_id, body) VALUES (%L, %L, ''Merci !'')', p, u));
  RESET ROLE;
  rep := (SELECT id FROM public.community_replies WHERE post_id = p AND user_id = u);
  r := r || public.__sonde_valeur('C4 … le compteur de réponses du post compte la réponse', '1', format('SELECT replies_count::text FROM public.community_posts WHERE id = %L', p));
  r := r || public.__sonde_valeur('C5 … et le post n''est pas « modifié » pour autant', '2026-01-01 00:00:00+00',
    format('SELECT updated_at::text FROM public.community_posts WHERE id = %L', p));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C6 l''auteur aime la réponse', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_reply_id) VALUES (%L, ''reply_like'', %L)', o, rep));
  RESET ROLE;
  r := r || public.__sonde_valeur('C7 … le compteur de la réponse compte le « j''aime »', '1', format('SELECT likes_count::text FROM public.community_replies WHERE id = %L', rep));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C8 il retire sa réaction', 'ACCEPTÉ',
    format('DELETE FROM public.engagement WHERE user_id = %L AND type = ''reaction'' AND target_post_id = %L', u, p));
  r := r || public.__sonde_ligne('C9 il retire sa réponse (suppression douce)', 'ACCEPTÉ',
    format('UPDATE public.community_replies SET deleted_at = now() WHERE id = %L', rep));
  RESET ROLE;
  r := r || public.__sonde_valeur('C10 … les deux compteurs du post reviennent à 0', '0 0',
    format('SELECT likes_count::text || '' '' || replies_count::text FROM public.community_posts WHERE id = %L', p));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C11 l''auteur corrige le titre de son post', 'ACCEPTÉ',
    format('UPDATE public.community_posts SET title = ''Sonde corrigée'' WHERE id = %L', p));
  RESET ROLE;
  r := r || public.__sonde_valeur('C12 … là, le post est « modifié » (témoin)', 'changé',
    format('SELECT CASE WHEN updated_at > ''2026-01-01T00:00:00Z'' THEN ''changé'' ELSE ''inchangé'' END FROM public.community_posts WHERE id = %L', p));

  ---------------------------------------------------------------------------
  -- F. Ce que la v0.145 écrit déjà traverse toujours les déclencheurs
  ---------------------------------------------------------------------------
  -- Une note de recette réveille désormais le recompte (sans rien y trouver à
  -- compter) ; une suppression pour de bon fait passer les cascades par les
  -- deux recomptes, qui verrouillent une ligne en train de disparaître.
  rid := (SELECT id FROM public.recipes_unified WHERE status = 'published' AND deleted_at IS NULL ORDER BY id LIMIT 1);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F1 il note une recette, comme le fait upsertReview', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_recipe_id, rating, body, deleted_at) VALUES (%L, ''review'', %L, 4, NULL, NULL) ON CONFLICT (user_id, type, target_recipe_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, deleted_at = EXCLUDED.deleted_at', u, rid));
  r := r || public.__sonde_ligne('F2 … puis change sa note (même requête, chemin « déjà noté »)', 'ACCEPTÉ',
    format('INSERT INTO public.engagement (user_id, type, target_recipe_id, rating, body, deleted_at) VALUES (%L, ''review'', %L, 5, ''Très bon'', NULL) ON CONFLICT (user_id, type, target_recipe_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, deleted_at = EXCLUDED.deleted_at', u, rid));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.community_posts (user_id, category, title, body) VALUES (o, 'general', 'Sonde 2', 'Second post de la sonde') RETURNING id INTO p2;
  INSERT INTO public.engagement (user_id, type, target_post_id, emoji) VALUES (u, 'reaction', p2, '🔥');
  INSERT INTO public.community_replies (post_id, user_id, body) VALUES (p2, u, 'Réponse aimée') RETURNING id INTO rep2;
  INSERT INTO public.engagement (user_id, type, target_reply_id) VALUES (o, 'reply_like', rep2);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F3 l''auteur supprime pour de bon un post qui porte une réaction et une réponse aimée', 'ACCEPTÉ',
    format('DELETE FROM public.community_posts WHERE id = %L', p2));
  RESET ROLE;
  r := r || public.__sonde_valeur('F4 … et rien n''en reste (réponse, réaction, « j''aime »)', '0',
    format('SELECT ((SELECT count(*) FROM public.community_replies WHERE post_id = %L) + (SELECT count(*) FROM public.engagement WHERE target_post_id = %L OR target_reply_id = %L))::text', p2, p2, rep2));
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.community_replies (post_id, user_id, body) VALUES (p, u, 'Autre réponse') RETURNING id INTO rep3;
  INSERT INTO public.engagement (user_id, type, target_reply_id) VALUES (o, 'reply_like', rep3);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('F5 il supprime pour de bon une réponse aimée', 'ACCEPTÉ',
    format('DELETE FROM public.community_replies WHERE id = %L', rep3));
  RESET ROLE;
  r := r || public.__sonde_valeur('F6 … le compteur de réponses du post revient à 0', '0',
    format('SELECT replies_count::text FROM public.community_posts WHERE id = %L', p));

  ---------------------------------------------------------------------------
  -- D. Les compteurs existants sont justes (après tout ce qui précède)
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('D1 posts dont le compteur de réactions est faux', '0',
    'SELECT count(*)::text FROM public.community_posts c WHERE c.likes_count <> (SELECT count(*) FROM public.engagement e WHERE e.target_post_id = c.id AND e.type IN (''reaction'', ''post_like'') AND e.deleted_at IS NULL)');
  r := r || public.__sonde_valeur('D2 posts dont le compteur de réponses est faux', '0',
    'SELECT count(*)::text FROM public.community_posts c WHERE c.replies_count <> (SELECT count(*) FROM public.community_replies x WHERE x.post_id = c.id AND x.deleted_at IS NULL)');
  r := r || public.__sonde_valeur('D3 réponses dont le compteur de « j''aime » est faux', '0',
    'SELECT count(*)::text FROM public.community_replies c WHERE c.likes_count <> (SELECT count(*) FROM public.engagement e WHERE e.target_reply_id = c.id AND e.type = ''reply_like'' AND e.deleted_at IS NULL)');

  ---------------------------------------------------------------------------
  -- E. La forme des fonctions
  ---------------------------------------------------------------------------
  r := r || public.__sonde_valeur('E1 get_public_profiles : droits du propriétaire, chemin de recherche vide', 'true search_path=""',
    'SELECT prosecdef::text || '' '' || array_to_string(proconfig, '','') FROM pg_proc WHERE oid = ''public.get_public_profiles(uuid[])''::regprocedure');
  r := r || public.__sonde_valeur('E2 les trois fonctions orphelines ont disparu', '0',
    'SELECT count(*)::text FROM pg_proc WHERE pronamespace = ''public''::regnamespace AND proname IN (''community_post_likes_count_fn'', ''community_reply_likes_count_fn'', ''recipe_reviews_set_updated_at_fn'')');
  r := r || public.__sonde_valeur('E3 le recompte des réponses ne se réveille que si une réponse naît, disparaît ou change de post', 'deleted_at,post_id',
    'SELECT coalesce((SELECT string_agg(a.attname, '','' ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid = t.tgrelid AND a.attnum = ANY (t.tgattr::int2[])), ''toute mise à jour'') FROM pg_trigger t WHERE t.tgname = ''community_replies_count_trg''');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-05, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT la migration (sans la section F, ajoutée ensuite) : 20 écarts.
--   A2 à A6, B1 à B7, E1 : les fonctions n'existent pas (42883).
--   C2, C4, C7 : 0 au lieu de 1 — ni la réaction, ni la réponse, ni le
--     « j'aime » ne sont comptés (la réponse d'un autre compte : la mise à
--     jour du compteur était filtrée par la règle « seul l'auteur modifie »).
--   C5 passait, mais pour une mauvaise raison : rien ne touchait le post.
--   D1 = 2 posts et D3 = 1 réponse au compteur faux dans la vraie base.
--   E2 = 3 fonctions orphelines ; E3 = « toute mise à jour ».
--
-- ESSAI À BLANC (migration collée dans le bloc) : 0 écart sur 37 gestes, la
--   section F comprise (note de recette par insertion puis reprise sur
--   conflit ; suppression définitive d'un post qui porte une réaction et une
--   réponse aimée ; suppression définitive d'une réponse aimée).
--
-- APRÈS application (`profils_publics_et_compteurs`) : 0 écart sur 37 gestes.
--   A2 rend le pseudo du compte lu (noté ici sans le recopier).
--   Analyseur de sécurité : 0 ERROR ; `get_public_profiles` rejoint la liste
--   `anon` (4) et `authenticated`, `search_public_profiles` la liste
--   `authenticated` (25) — voir la note interne sur les advisors Supabase.
