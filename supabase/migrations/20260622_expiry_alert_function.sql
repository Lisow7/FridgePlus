-- Anti-gaspi 1C — etat anti-spam + fonction cron de generation des alertes de peremption.

ALTER TABLE public.user_stock
  ADD COLUMN IF NOT EXISTS expiry_alert_stage smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_stock.expiry_alert_stage IS
  'Anti-gaspi 1C : 0=aucune alerte, 1=alerte orange envoyee, 2=alerte rouge envoyee. Reset implicite (item retire = ligne supprimee).';

CREATE OR REPLACE FUNCTION public.notify_stock_expiry_run()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec       record;
  n_created integer := 0;
  v_count   int;
BEGIN
  FOR rec IN
    WITH flagged AS (
      SELECT
        us.user_id,
        us.ingredient_id,
        i.labels->>'fr' AS name_fr,
        i.labels->>'en' AS name_en,
        us.expiry_alert_stage AS stage,
        COALESCE(us.expires_at, us.added_at + (COALESCE(sl.days, 14) * interval '1 day')) AS expiry
      FROM public.user_stock us
      JOIN public.ingredients i        ON i.id = us.ingredient_id
      LEFT JOIN public.shelf_life_days sl ON sl.subcategory = i.subcategory
    ),
    classified AS (
      SELECT *,
        (stage < 1 AND expiry > now() AND expiry <= now() + interval '3 days') AS is_amber,
        (stage < 2 AND expiry <= now())                                        AS is_red
      FROM flagged
    )
    SELECT
      user_id,
      array_agg(ingredient_id) FILTER (WHERE is_amber) AS amber_ids,
      array_agg(name_fr)       FILTER (WHERE is_amber) AS amber_fr,
      array_agg(name_en)       FILTER (WHERE is_amber) AS amber_en,
      array_agg(ingredient_id) FILTER (WHERE is_red)   AS red_ids,
      array_agg(name_fr)       FILTER (WHERE is_red)   AS red_fr,
      array_agg(name_en)       FILTER (WHERE is_red)   AS red_en
    FROM classified
    WHERE is_amber OR is_red
    GROUP BY user_id
  LOOP
    -- ALERTE ORANGE
    IF rec.amber_ids IS NOT NULL AND array_length(rec.amber_ids, 1) > 0 THEN
      v_count := array_length(rec.amber_ids, 1);
      INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, metadata)
      VALUES (
        rec.user_id, 'user', 'stock_expiring_soon',
        jsonb_build_object('fr', 'À cuisiner bientôt', 'en', 'Cook soon'),
        jsonb_build_object(
          'fr', v_count || ' ingrédient' || (CASE WHEN v_count > 1 THEN 's vont' ELSE ' va' END)
                || ' bientôt périmer : ' || array_to_string(rec.amber_fr, ', ') || '.',
          'en', v_count || ' ingredient' || (CASE WHEN v_count > 1 THEN 's' ELSE '' END)
                || ' will spoil soon: ' || array_to_string(rec.amber_en, ', ') || '.'
        ),
        jsonb_build_object('ids', to_jsonb(rec.amber_ids), 'count', v_count)
      );
      UPDATE public.user_stock SET expiry_alert_stage = 1
        WHERE user_id = rec.user_id AND ingredient_id = ANY(rec.amber_ids);
      n_created := n_created + 1;
    END IF;

    -- ALERTE ROUGE
    IF rec.red_ids IS NOT NULL AND array_length(rec.red_ids, 1) > 0 THEN
      v_count := array_length(rec.red_ids, 1);
      INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, metadata)
      VALUES (
        rec.user_id, 'user', 'stock_expiring_today',
        jsonb_build_object('fr', 'Dernière chance', 'en', 'Last chance'),
        jsonb_build_object(
          'fr', v_count || ' ingrédient' || (CASE WHEN v_count > 1 THEN 's arrivent' ELSE ' arrive' END)
                || ' à date : ' || array_to_string(rec.red_fr, ', ')
                || '. Cuisine-' || (CASE WHEN v_count > 1 THEN 'les' ELSE 'le' END) || ' vite !',
          'en', v_count || ' ingredient' || (CASE WHEN v_count > 1 THEN 's reach their date: ' ELSE ' reaches its date: ' END)
                || array_to_string(rec.red_en, ', ')
                || (CASE WHEN v_count > 1 THEN '. Cook them now!' ELSE '. Cook it now!' END)
        ),
        jsonb_build_object('ids', to_jsonb(rec.red_ids), 'count', v_count)
      );
      UPDATE public.user_stock SET expiry_alert_stage = 2
        WHERE user_id = rec.user_id AND ingredient_id = ANY(rec.red_ids);
      n_created := n_created + 1;
    END IF;
  END LOOP;

  RETURN n_created;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_stock_expiry_run() FROM public, anon, authenticated;
