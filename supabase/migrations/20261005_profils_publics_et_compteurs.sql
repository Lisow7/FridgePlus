-- 2026-10-05 — Les auteurs de la communauté ont un nom, et ses compteurs
-- comptent. Audit du 2026-10-04 : BDD-13 (lot 3b).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS (prouvés sur la vraie base le 2026-10-05)
--
-- 1. La règle de lecture de `profiles` est « sa propre ligne, ou admin ». Les
--    posts, les réponses et les avis joignaient le profil de l'auteur : pour
--    tout lecteur non admin, auteur illisible → « Utilisateur supprimé »,
--    « Anonyme », fiche profil « Profil introuvable », et « signaler un
--    utilisateur » (support) ne trouvait personne. L'admin, qui voit tout, ne
--    pouvait pas le remarquer.
-- 2. `likes_count` des posts et des réponses n'est plus tenu depuis la refonte
--    (les « j'aime » vivent dans `engagement` ; les fonctions qui tenaient le
--    compteur visaient des tables supprimées et n'ont plus de déclencheur) :
--    le tri « Populaires » ne triait rien.
-- 3. `replies_count` était mis à jour AUX DROITS de la personne qui répond : la
--    règle « seul l'auteur modifie son post » filtrait la mise à jour, et le
--    compteur ne bougeait pas quand on répondait au post de quelqu'un d'autre.
-- 4. Toute mise à jour d'un post ou d'une réponse — un compteur compris —
--    avançait `updated_at` : une fois les compteurs réparés, le post aurait
--    affiché « modifié » à chaque réaction.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- • `get_public_profiles(ids)` (la recommandation de l'audit) : ne rend QUE
--   l'identifiant, le pseudo, l'avatar, la bannière, la bio et la date
--   d'inscription (« membre depuis » de la fiche) — jamais une autre colonne ;
--   comptes supprimés exclus ; 200 identifiants au plus par appel. Ouverte aux
--   visiteurs : le fil de la communauté l'est. Pas de vue publique : elle ferait
--   passer l'analyseur de sécurité en ERROR (`security_definer_view`).
-- • `search_public_profiles(q)` : la recherche de « signaler un utilisateur »
--   — comptes connectés seulement, 2 caractères au moins, 8 résultats ; ni
--   l'admin, ni un compte supprimé, ni soi-même, ni un compte qui n'a rien
--   publié de visible (on ne signale que quelqu'un qu'on a pu lire — et la
--   recherche ne devient pas un annuaire de tous les inscrits).
-- • `recompter_jaime()` : à chaque « j'aime » ou réaction ajouté, retiré ou
--   remis, recompte `likes_count` depuis la source (posts : réactions et anciens
--   `post_like` ; réponses : `reply_like`).
-- • `community_replies_count_fn()` : recompte `replies_count` depuis la source,
--   avec les droits du propriétaire de la fonction ; son déclencheur ne se
--   réveille plus que si une réponse naît, disparaît ou change de post.
--   Les deux recomptes VERROUILLENT d'abord la ligne du compteur : deux gestes
--   simultanés sur le même post s'attendent, et le second compte avec une image
--   de la base prise après le premier (chaque instruction en prend une neuve).
--   Un recompte se répare de lui-même au geste suivant, là où un +1/−1 dérive.
-- • `community_set_updated_at_fn()` : `updated_at` n'avance que si le CONTENU
--   change, pas un compteur.
-- • Trois fonctions orphelines (aucun déclencheur, tables d'origine
--   supprimées) sont retirées.
-- • Rattrapage : tous les compteurs sont recalculés une fois.
--
-- PREUVE : `supabase/probes/20261005_profils_publics_et_compteurs.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Lire le nom d'un auteur ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_public_profiles(p_ids uuid[])
RETURNS TABLE (id uuid, username text, avatar_id text, banner_id text, community_bio text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.id, p.username, p.avatar_id, p.banner_id, p.community_bio, p.created_at
    FROM public.profiles p
   WHERE p.id = ANY ((p_ids)[1:200])
     AND p.deleted_at IS NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- ── Chercher un compte à signaler ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_public_profiles(p_query text)
RETURNS TABLE (id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH q AS (
    SELECT btrim(coalesce(p_query, '')) AS brut,
           replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') AS motif
  )
  SELECT p.id, p.username
    FROM public.profiles p, q
   WHERE char_length(q.brut) >= 2
     AND p.username ILIKE '%' || q.motif || '%'
     AND p.role <> 'admin'
     AND p.deleted_at IS NULL
     AND p.id <> (SELECT auth.uid())
     AND (EXISTS (SELECT 1 FROM public.community_posts x WHERE x.user_id = p.id AND x.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.community_replies x WHERE x.user_id = p.id AND x.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.engagement x WHERE x.user_id = p.id AND x.type = 'review' AND x.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.recipes_unified x WHERE x.user_id = p.id AND x.status = 'published' AND x.deleted_at IS NULL))
   ORDER BY lower(p.username) = lower(q.brut) DESC,
            p.username ILIKE q.motif || '%' DESC,
            p.username
   LIMIT 8;
$function$;

REVOKE ALL ON FUNCTION public.search_public_profiles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO authenticated;

-- ── Les « j'aime » et les réactions ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recompter_jaime()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_posts   uuid[] := ARRAY[]::uuid[];
  v_replies uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_posts   := v_posts   || NEW.target_post_id;
    v_replies := v_replies || NEW.target_reply_id;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    v_posts   := v_posts   || OLD.target_post_id;
    v_replies := v_replies || OLD.target_reply_id;
  END IF;

  PERFORM 1 FROM public.community_posts WHERE id = ANY (v_posts) ORDER BY id FOR UPDATE;
  UPDATE public.community_posts c
     SET likes_count = (SELECT count(*) FROM public.engagement e
                         WHERE e.target_post_id = c.id AND e.type IN ('reaction', 'post_like') AND e.deleted_at IS NULL)
   WHERE c.id = ANY (v_posts);

  PERFORM 1 FROM public.community_replies WHERE id = ANY (v_replies) ORDER BY id FOR UPDATE;
  UPDATE public.community_replies c
     SET likes_count = (SELECT count(*) FROM public.engagement e
                         WHERE e.target_reply_id = c.id AND e.type = 'reply_like' AND e.deleted_at IS NULL)
   WHERE c.id = ANY (v_replies);

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.recompter_jaime() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recompter_jaime ON public.engagement;
CREATE TRIGGER trg_recompter_jaime
  AFTER INSERT OR DELETE OR UPDATE OF deleted_at, type, target_post_id, target_reply_id ON public.engagement
  FOR EACH ROW EXECUTE FUNCTION public.recompter_jaime();

-- ── Les réponses ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.community_replies_count_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_posts uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_posts := v_posts || NEW.post_id; END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN v_posts := v_posts || OLD.post_id; END IF;

  PERFORM 1 FROM public.community_posts WHERE id = ANY (v_posts) ORDER BY id FOR UPDATE;
  UPDATE public.community_posts c
     SET replies_count = (SELECT count(*) FROM public.community_replies r
                           WHERE r.post_id = c.id AND r.deleted_at IS NULL)
   WHERE c.id = ANY (v_posts);

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.community_replies_count_fn() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS community_replies_count_trg ON public.community_replies;
CREATE TRIGGER community_replies_count_trg
  AFTER INSERT OR DELETE OR UPDATE OF deleted_at, post_id ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.community_replies_count_fn();

-- ── « Modifié » ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.community_set_updated_at_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Un compteur qui bouge n'est pas une modification du contenu.
  IF (to_jsonb(NEW) - 'likes_count' - 'replies_count' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'likes_count' - 'replies_count' - 'updated_at') THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Orphelines ────────────────────────────────────────────────────────────
-- Sans déclencheur depuis la refonte ; elles lisent `post_id` / `reply_id`,
-- colonnes des tables supprimées, et ne pourraient servir à rien d'autre.
-- Sans CASCADE : si quelque chose en dépendait, la migration s'arrêterait.

DROP FUNCTION IF EXISTS public.community_post_likes_count_fn();
DROP FUNCTION IF EXISTS public.community_reply_likes_count_fn();
DROP FUNCTION IF EXISTS public.recipe_reviews_set_updated_at_fn();

-- ── Rattrapage, une fois ──────────────────────────────────────────────────
-- Ces mises à jour ne changent que des compteurs : `updated_at` n'avance pas.

UPDATE public.community_posts c
   SET likes_count = (SELECT count(*) FROM public.engagement e
                       WHERE e.target_post_id = c.id AND e.type IN ('reaction', 'post_like') AND e.deleted_at IS NULL),
       replies_count = (SELECT count(*) FROM public.community_replies r
                         WHERE r.post_id = c.id AND r.deleted_at IS NULL);

UPDATE public.community_replies c
   SET likes_count = (SELECT count(*) FROM public.engagement e
                       WHERE e.target_reply_id = c.id AND e.type = 'reply_like' AND e.deleted_at IS NULL);

COMMIT;
