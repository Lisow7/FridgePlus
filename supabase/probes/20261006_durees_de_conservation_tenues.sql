-- Sonde de la migration 20261006_durees_de_conservation_tenues.sql : deux
-- durées de conservation tenues par la base (décision du 2026-10-06 —
-- « purge_usage = oui », « ban_sans_fin = 3_ans »).
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Les empreintes de la sonde portent des adresses en `.invalid` (domaine
-- réservé, jamais attribué) ; les événements de la sonde portent un `anon_id`
-- « sonde-… » (les vrais sont des UUID). Tout est annulé par le RAISE final : aucun compte, aucune
-- vraie empreinte, aucun vrai événement n'est créé, modifié ni effacé.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
BEGIN
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

  -- [essai à blanc : le DDL de la migration est injecté ici]

  -- A. L'empreinte d'un compte banni a toujours une fin, 3 ans au plus.
  PERFORM private.retenir_l_empreinte('sonde-sans-fin@exemple.invalid', true, NULL);
  r := r || public.__sonde_valeur('A1 bannissement « sans fin » : empreinte gardée 3 ans', 'true',
    $q$SELECT (jusqu_au BETWEEN now() + interval '3 years' - interval '1 minute' AND now() + interval '3 years' + interval '1 minute')::text
         FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-sans-fin@exemple.invalid')$q$);

  PERFORM private.retenir_l_empreinte('sonde-dix-jours@exemple.invalid', true, now() + interval '10 days');
  r := r || public.__sonde_valeur('A2 bannissement de 10 jours : empreinte jusqu''à sa fin, pas plus', 'true',
    $q$SELECT (jusqu_au = now() + interval '10 days')::text
         FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-dix-jours@exemple.invalid')$q$);

  PERFORM private.retenir_l_empreinte('sonde-dix-ans@exemple.invalid', true, now() + interval '10 years');
  r := r || public.__sonde_valeur('A3 bannissement de 10 ans : empreinte ramenée à 3 ans', 'true',
    $q$SELECT (jusqu_au BETWEEN now() + interval '3 years' - interval '1 minute' AND now() + interval '3 years' + interval '1 minute')::text
         FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-dix-ans@exemple.invalid')$q$);

  PERFORM private.retenir_l_empreinte('sonde-echu@exemple.invalid', true, now() - interval '1 day');
  r := r || public.__sonde_valeur('A4 bannissement échu : aucune empreinte', '0',
    $q$SELECT count(*)::text FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-echu@exemple.invalid')$q$);

  PERFORM private.retenir_l_empreinte('sonde-dix-jours@exemple.invalid', true, NULL);
  r := r || public.__sonde_valeur('A5 même adresse, puis « sans fin » : la plus longue gagne, 3 ans au plus', 'true',
    $q$SELECT (jusqu_au BETWEEN now() + interval '3 years' - interval '1 minute' AND now() + interval '3 years' + interval '1 minute')::text
         FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-dix-jours@exemple.invalid')$q$);

  r := r || public.__sonde_valeur('A6 une empreinte sans fin ne peut plus s''écrire (colonne NOT NULL)', 'true',
    $q$SELECT attnotnull::text FROM pg_attribute WHERE attrelid = 'private.adresses_interdites'::regclass AND attname = 'jusqu_au'$q$);

  -- B. Les deux tâches existent, chaque jour, avec leur commande exacte.
  r := r || public.__sonde_valeur('B1 tâche des empreintes échues', 'true 25 4 * * * DELETE FROM private.adresses_interdites WHERE jusqu_au < now()',
    $q$SELECT active::text || ' ' || schedule || ' ' || command FROM cron.job WHERE jobname = 'purge_adresses_interdites_echues'$q$);
  r := r || public.__sonde_valeur('B2 tâche des statistiques d''usage', 'true 35 4 * * * DELETE FROM public.product_events WHERE occurred_at < now() - interval ''13 months''',
    $q$SELECT active::text || ' ' || schedule || ' ' || command FROM cron.job WHERE jobname = 'purge_product_events_13_mois'$q$);
  r := r || public.__sonde_valeur('B3 elles tournent sous postgres, comme les autres purges', '2',
    $q$SELECT count(*)::text FROM cron.job WHERE jobname IN ('purge_adresses_interdites_echues', 'purge_product_events_13_mois') AND username = 'postgres'$q$);

  -- C. Les commandes des tâches, rejouées telles qu'enregistrées, effacent ce
  -- qu'elles doivent et rien d'autre.
  INSERT INTO private.adresses_interdites (empreinte, jusqu_au)
  VALUES (private.empreinte_adresse('sonde-perimee@exemple.invalid'), now() - interval '1 second');
  INSERT INTO public.product_events (occurred_at, event, anon_id) VALUES
    (now() - interval '13 months' - interval '1 day', 'recipe_opened', 'sonde-vieux'),
    (now() - interval '13 months' + interval '1 day', 'recipe_opened', 'sonde-recent');
  BEGIN
    EXECUTE (SELECT command FROM cron.job WHERE jobname = 'purge_adresses_interdites_echues');
    EXECUTE (SELECT command FROM cron.job WHERE jobname = 'purge_product_events_13_mois');
  EXCEPTION WHEN OTHERS THEN
    r := r || E'\nC0 rejouer les tâches — attendu sans erreur : ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 70) || ' ⚠';
  END;
  r := r || public.__sonde_valeur('C1 empreinte périmée effacée, empreintes en cours gardées', '0 3',
    $q$SELECT (SELECT count(*) FROM private.adresses_interdites WHERE empreinte = private.empreinte_adresse('sonde-perimee@exemple.invalid'))::text || ' ' ||
              (SELECT count(*) FROM private.adresses_interdites WHERE empreinte IN (private.empreinte_adresse('sonde-sans-fin@exemple.invalid'),
                 private.empreinte_adresse('sonde-dix-jours@exemple.invalid'), private.empreinte_adresse('sonde-dix-ans@exemple.invalid')))::text$q$);
  r := r || public.__sonde_valeur('C2 événement de 13 mois et un jour effacé, celui de 13 mois moins un jour gardé', 'sonde-recent',
    $q$SELECT string_agg(anon_id, ',') FROM public.product_events WHERE anon_id IN ('sonde-vieux', 'sonde-recent')$q$);

  -- D. Rien d'ouvert à l'API.
  r := r || public.__sonde_valeur('D1 retenir_l_empreinte fermée à PUBLIC, anon et authenticated', '0',
    $q$SELECT count(*)::text FROM unnest(ARRAY['public','anon','authenticated']) AS role(nom)
        WHERE has_function_privilege(role.nom, 'private.retenir_l_empreinte(text,boolean,timestamptz)'::regprocedure, 'EXECUTE')$q$);

  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-06, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT : 10 écarts sur 13 gestes — empreinte « sans fin » à NULL (A1, A5),
--   un bannissement de 10 ans gardé 10 ans (A3), colonne sans NOT NULL (A6),
--   aucune des deux tâches (B1 à B3, C0), donc rien d'effacé (C1, C2). Tiennent
--   déjà : la fin d'un bannissement daté (A2), le bannissement échu (A4), les
--   droits (D1).
-- ESSAI À BLANC (DDL du fichier injecté tel quel, `SELECT` → `PERFORM`, par
--   un script et non à la main) : 0 écart sur 12 gestes.
-- APRÈS application (`durees_de_conservation_tenues`, version
--   20261006105016) : 0 écart sur 12 gestes. Vérifié ensuite : 1 135
--   événements (inchangé), aucune ligne de sonde, aucune empreinte, aucune
--   fonction de sonde restante.
--
-- Leçon : composer l'essai à blanc par un script évite l'oubli de la
-- précédente (les REVOKE) — mais `String.replace` lit « $$ » comme « $ » dans
-- la chaîne de remplacement : passer une fonction.
