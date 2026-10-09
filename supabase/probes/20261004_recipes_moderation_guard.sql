-- Sonde du garde `guard_recipes_moderation_columns` (migration
-- 20261004_recipes_moderation_guard.sql). Audit du 2026-10-04, BDD-01 / SEC-01.
--
-- À QUOI ELLE SERT
-- La CI ne parle pas à Supabase : aucun test du dépôt ne peut voir une règle de
-- la base. Cette sonde la joue pour de vrai, contre la base réelle, SANS RIEN Y
-- LAISSER : tout est dans un seul bloc DO qui se termine par RAISE EXCEPTION,
-- donc intégralement annulé. Le « message d'erreur » EST le rapport.
--
-- COMMENT LA LANCER
-- Coller le fichier entier dans l'éditeur SQL de Supabase (ou `execute_sql`).
-- Lire le rapport : chaque ligne dit ce qui était attendu et ce qui s'est passé.
-- Une ligne « ⚠ » est un écart. Elle prend un compte ordinaire et le compte admin
-- au hasard ; elle n'affiche aucune donnée personnelle.
--
-- RÉSULTATS DU 2026-10-04
-- 1. Essai à blanc AVANT application (le DDL de la migration exécuté dans le
--    même bloc, donc annulé avec lui) : 26 lignes, 1 écart — pas sur le garde.
--    Les tricheries sont refusées PAR LE GARDE (03, 04, 06, 07, 08 — le message
--    le dit : 42501 est aussi le code d'un refus de RLS, la sonde vérifie donc
--    le texte), ramenées à leur valeur (11, 12, 19) ou refusées par les
--    contraintes (22a, 22b). Les chemins légitimes passent.
-- 2. L'écart : la ligne 21 demandait une « suppression douce » par l'auteur
--    (`UPDATE … SET deleted_at`). La base la REFUSE, avec ou sans le garde
--    (rejoué sans lui) : la politique de lecture exige `deleted_at IS NULL`, et
--    PostgreSQL l'applique aussi à la NOUVELLE ligne d'un UPDATE. Aucun effet
--    pour l'utilisateur : l'app supprime par `delete_custom_recipe_rgpd`, et
--    `softDeleteCommunityRecipe` n'a plus d'appelant. La ligne 21 joue donc
--    désormais le chemin réel.
-- 3. APRÈS application (`20261004191021`) : déclencheur actif et premier dans
--    l'ordre, contraintes validées, 515 recettes inchangées, tricheries
--    refusées, proposition / approbation par l'admin / suppression acceptées.

DO $probe$
DECLARE
  a    uuid;                     -- le compte admin
  u    uuid;                     -- un compte ordinaire
  rid  text := 'sonde-garde-' || substr(md5(random()::text), 1, 8);
  off  text;                     -- une recette officielle existante
  r    text := '';
  n    integer;
  obtenu text;                   -- remplacé à chaque sonde
BEGIN
  SELECT id INTO a FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND COALESCE(banned, false) = false AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;
  SELECT id INTO off FROM public.recipes_unified WHERE origin = 'official' ORDER BY id LIMIT 1;
  IF a IS NULL OR u IS NULL OR off IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un admin, un compte ordinaire et une recette officielle';
  END IF;

  -- (Pour un essai à blanc AVANT d'appliquer une migration, exécuter son DDL ici
  -- par `EXECUTE` : il sera annulé avec le reste.)

  ---------------------------------------------------------------------------
  -- En tant que compte ordinaire
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 01
  BEGIN
    INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote, admin_modified, moderation_reason)
    VALUES (rid || '-a', u, 'Sonde privée', '{"name":"Sonde privée","emoji":"🍳"}'::jsonb, 'private', false, false, false, NULL);
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n01 créer une recette privée (vue) — attendu ACCEPTÉ : ' || obtenu || CASE WHEN obtenu = 'ACCEPTÉ' THEN '' ELSE ' ⚠' END;

  -- 02
  BEGIN
    INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote, admin_modified, moderation_reason)
    VALUES (rid || '-b', u, 'Sonde proposée', '{"name":"Sonde proposée","emoji":"🍳"}'::jsonb, 'pending', true, true, false, NULL);
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n02 proposer une recette à la validation (vue) — attendu ACCEPTÉ : ' || obtenu || CASE WHEN obtenu = 'ACCEPTÉ' THEN '' ELSE ' ⚠' END;

  -- 03
  BEGIN
    INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote, admin_modified, moderation_reason)
    VALUES (rid || '-c', u, 'Sonde auto-approuvée', '{"name":"x","emoji":"🍳"}'::jsonb, 'approved', true, false, false, NULL);
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n03 créer une recette déjà approuvée (vue) — attendu REFUSÉ par le garde : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 forbidden: recipe moderation columns%' THEN '' ELSE ' ⚠' END;

  -- 04
  BEGIN
    INSERT INTO public.recipes_unified (id, origin, user_id, title, name, moderation_status, is_public)
    VALUES (rid || '-d', 'community', u, 'x', '{"fr":"x"}'::jsonb, 'approved', true);
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n04 insérer directement une recette approuvée et publique (table) — attendu REFUSÉ par le garde : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 forbidden: recipe moderation columns%' THEN '' ELSE ' ⚠' END;

  -- 05
  BEGIN
    INSERT INTO public.recipes_unified (id, origin, user_id, title, name)
    VALUES (rid || '-e', 'community', u, 'x', '{"fr":"x"}'::jsonb);
    SELECT moderation_status || '/' || status INTO obtenu FROM public.recipes_unified WHERE id = rid || '-e';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n05 insérer sans statut, défauts de la table — attendu private/draft : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'private/draft' THEN '' ELSE ' ⚠' END;

  -- 06
  BEGIN
    INSERT INTO public.recipes_unified (id, origin, user_id, title, name, promoted_from_id, original_author_name)
    VALUES (rid || '-f', 'community', u, 'x', '{"fr":"x"}'::jsonb, off, 'Un chef connu');
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n06 se déclarer promue et signée d''un autre auteur — attendu REFUSÉ par le garde : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 forbidden: recipe moderation columns%' THEN '' ELSE ' ⚠' END;

  -- 07
  BEGIN
    UPDATE public.recipes_unified SET moderation_status = 'approved', is_public = true WHERE id = rid || '-b';
    GET DIAGNOSTICS n = ROW_COUNT;
    obtenu := 'ACCEPTÉ (' || n || ' ligne)';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n07 approuver soi-même sa recette en attente (table) — attendu REFUSÉ par le garde : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 forbidden: recipe moderation columns%' THEN '' ELSE ' ⚠' END;

  -- 08
  BEGIN
    UPDATE public.custom_recipes SET moderation_status = 'approved' WHERE id = rid || '-b';
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n08 approuver soi-même sa recette en attente (vue) — attendu REFUSÉ par le garde : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 forbidden: recipe moderation columns%' THEN '' ELSE ' ⚠' END;

  -- 09
  BEGIN
    UPDATE public.custom_recipes SET moderation_status = 'private', is_public = false WHERE id = rid || '-b';
    UPDATE public.custom_recipes SET moderation_status = 'pending', is_public = true WHERE id = rid || '-b';
    SELECT moderation_status || '/' || status INTO obtenu FROM public.recipes_unified WHERE id = rid || '-b';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n09 retirer sa proposition puis la reproposer — attendu pending/draft : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'pending/draft' THEN '' ELSE ' ⚠' END;

  -- 10
  BEGIN
    INSERT INTO public.custom_recipes (id, user_id, title, data, moderation_status, is_public, consent_to_promote, admin_modified, moderation_reason)
    VALUES (rid || '-b', u, 'Sonde proposée (relue)', '{"name":"Sonde proposée (relue)","emoji":"🍲"}'::jsonb, 'pending', true, true, false, NULL);
    SELECT title || ' / ' || emoji INTO obtenu FROM public.recipes_unified WHERE id = rid || '-b';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n10 ré-enregistrer sa recette (même identifiant, vue) — attendu le nouveau titre : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'Sonde proposée (relue) / 🍲' THEN '' ELSE ' ⚠' END;

  -- 11
  BEGIN
    UPDATE public.recipes_unified SET status = 'published' WHERE id = rid || '-b';
    SELECT status INTO obtenu FROM public.recipes_unified WHERE id = rid || '-b';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n11 écrire status = published sur sa recette en attente — attendu draft : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'draft' THEN '' ELSE ' ⚠' END;

  -- 12 et 13
  BEGIN
    UPDATE public.recipes_unified SET admin_modified = true, moderation_reason = 'faux motif' WHERE id = rid || '-b';
    SELECT COALESCE(admin_modified, false)::text || ' / ' || COALESCE(moderation_reason, '(vide)') INTO obtenu FROM public.recipes_unified WHERE id = rid || '-b';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n12 se donner le drapeau « modifiée par l''admin » et un motif — attendu false / (vide) : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'false / (vide)' THEN '' ELSE ' ⚠' END;

  -- 22 (emoji, image)
  BEGIN
    UPDATE public.recipes_unified SET emoji = '<script src=//x>' WHERE id = rid || '-a';
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n22a emoji contenant une balise — attendu REFUSÉ par la contrainte : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 23514%recipes_unified_emoji_check%' THEN '' ELSE ' ⚠' END;
  BEGIN
    UPDATE public.recipes_unified SET image_url = 'https://attaquant.exemple/p.gif?r=1' WHERE id = rid || '-a';
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n22b image hébergée ailleurs — attendu REFUSÉ par la contrainte : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 23514%recipes_unified_image_url_check%' THEN '' ELSE ' ⚠' END;
  BEGIN
    UPDATE public.recipes_unified SET image_url = 'https://bymuvgjghtupfzwjbice.supabase.co/storage/v1/object/public/recipe-photos/carbonara.webp', emoji = '👩‍🍳' WHERE id = rid || '-a';
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n22c image du stockage du projet et emoji composé — attendu ACCEPTÉ : ' || obtenu || CASE WHEN obtenu = 'ACCEPTÉ' THEN '' ELSE ' ⚠' END;

  ---------------------------------------------------------------------------
  -- En tant que visiteur anonyme
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.recipes_unified WHERE id LIKE rid || '%';
  r := r || E'\n14 un visiteur anonyme voit les recettes de la sonde — attendu 0 : ' || n || CASE WHEN n = 0 THEN '' ELSE ' ⚠' END;

  ---------------------------------------------------------------------------
  -- En tant qu'admin
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 15
  BEGIN
    UPDATE public.custom_recipes SET moderation_status = 'approved', is_public = true WHERE id = rid || '-b';
    SELECT moderation_status || '/' || status INTO obtenu FROM public.recipes_unified WHERE id = rid || '-b';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n15 l''admin approuve la recette proposée (vue) — attendu approved/published : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'approved/published' THEN '' ELSE ' ⚠' END;

  -- 17
  BEGIN
    UPDATE public.custom_recipes SET admin_modified = true, moderation_reason = 'Titre corrigé' WHERE id = rid || '-a';
    SELECT COALESCE(admin_modified, false)::text || ' / ' || COALESCE(moderation_reason, '(vide)') INTO obtenu FROM public.recipes_unified WHERE id = rid || '-a';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n17 l''admin marque une recette comme modifiée, avec un motif — attendu true / Titre corrigé : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'true / Titre corrigé' THEN '' ELSE ' ⚠' END;

  -- 26
  BEGIN
    UPDATE public.base_recipes SET emoji = emoji WHERE id = off;
    GET DIAGNOSTICS n = ROW_COUNT;
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n26 l''admin modifie une recette officielle (vue base_recipes) — attendu ACCEPTÉ : ' || obtenu || CASE WHEN obtenu = 'ACCEPTÉ' THEN '' ELSE ' ⚠' END;

  -- 23
  BEGIN
    PERFORM public.promote_recipe_to_base(rid || '-b');
    SELECT count(*) INTO n FROM public.recipes_unified WHERE origin = 'official' AND promoted_from_id = rid || '-b' AND original_author_id = u;
    obtenu := n || ' recette officielle créée';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n23 l''admin promeut la recette approuvée — attendu 1 recette officielle créée : ' || obtenu || CASE WHEN obtenu = '1 recette officielle créée' THEN '' ELSE ' ⚠' END;

  ---------------------------------------------------------------------------
  -- Visiteur anonyme, après approbation
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.recipes_unified WHERE id = rid || '-b';
  r := r || E'\n16 un visiteur anonyme voit la recette approuvée par l''admin — attendu 1 : ' || n || CASE WHEN n = 1 THEN '' ELSE ' ⚠' END;

  ---------------------------------------------------------------------------
  -- De nouveau le compte ordinaire
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 18
  BEGIN
    UPDATE public.custom_recipes SET admin_modified = false WHERE id = rid || '-a' AND user_id = u;
    SELECT COALESCE(admin_modified, false)::text || ' / ' || COALESCE(moderation_reason, '(vide)') INTO obtenu FROM public.recipes_unified WHERE id = rid || '-a';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n18 l''auteur ferme le bandeau « modifiée par l''admin » — attendu false / (vide) ou false / Titre corrigé : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu LIKE 'false / %' THEN '' ELSE ' ⚠' END;

  -- 19 : remettre un motif puis vérifier qu'il n'est pas remplaçable
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.recipes_unified SET moderation_reason = 'Motif de l''admin' WHERE id = rid || '-a';
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.recipes_unified SET moderation_reason = 'Motif réécrit par l''auteur' WHERE id = rid || '-a';
    SELECT COALESCE(moderation_reason, '(vide)') INTO obtenu FROM public.recipes_unified WHERE id = rid || '-a';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n19 l''auteur réécrit le motif de l''admin — attendu Motif de l''admin : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'Motif de l''admin' THEN '' ELSE ' ⚠' END;

  -- 20
  BEGIN
    UPDATE public.custom_recipes SET title = 'Contenu changé après approbation' WHERE id = rid || '-b';
    obtenu := 'ACCEPTÉ';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n20 l''auteur modifie sa recette déjà approuvée — attendu REFUSÉ par le garde existant : ' || obtenu || CASE WHEN obtenu LIKE 'REFUSÉ 42501 Cannot edit an approved recipe%' THEN '' ELSE ' ⚠' END;

  -- 21 : par la fonction que l'app appelle (la « suppression douce » directe est
  -- refusée par la RLS, voir l'en-tête).
  BEGIN
    PERFORM public.delete_custom_recipe_rgpd(rid || '-a');
    SELECT count(*) INTO n FROM public.recipes_unified WHERE id = rid || '-a';
    obtenu := n || ' ligne restante';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n21 l''auteur supprime définitivement sa recette (delete_custom_recipe_rgpd) — attendu 0 ligne restante : ' || obtenu || CASE WHEN obtenu = '0 ligne restante' THEN '' ELSE ' ⚠' END;

  -- 24 : anonymize_user efface le nom d'auteur d'une recette OFFICIELLE au nom
  -- d'un compte ordinaire. Le garde ne doit pas s'en mêler.
  BEGIN
    PERFORM public.anonymize_user(u);
    RESET ROLE;
    SELECT count(*) INTO n FROM public.recipes_unified WHERE origin = 'official' AND promoted_from_id = rid || '-b' AND original_author_name IS NULL;
    obtenu := n || ' nom d''auteur effacé';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n24 le compte s''anonymise (anonymize_user) — attendu 1 nom d''auteur effacé : ' || obtenu || CASE WHEN obtenu = '1 nom d''auteur effacé' THEN '' ELSE ' ⚠' END;

  ---------------------------------------------------------------------------
  -- Sans utilisateur (rôle de service, scripts du dépôt, tâches planifiées)
  ---------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    UPDATE public.recipes_unified SET updated_at = updated_at WHERE id = off;
    UPDATE public.recipes_unified SET moderation_status = 'rejected', moderation_reason = 'Purge' WHERE id = rid || '-e';
    SELECT moderation_status INTO obtenu FROM public.recipes_unified WHERE id = rid || '-e';
  EXCEPTION WHEN OTHERS THEN obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 110); END;
  r := r || E'\n25 une écriture sans utilisateur (script, tâche planifiée) n''est pas gênée — attendu rejected : ' || COALESCE(obtenu, 'illisible') || CASE WHEN obtenu = 'rejected' THEN '' ELSE ' ⚠' END;

  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;
