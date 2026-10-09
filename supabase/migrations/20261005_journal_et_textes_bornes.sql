-- 2026-10-05 — Le journal d'activité n'accepte d'un compte ordinaire que ce que
-- l'application écrit, et les textes libres ont une taille maximale.
-- Audit du 2026-10-04 : ADM-07 (correctif principal), BDD-10 ; une partie
-- d'ADM-28 (l'heure du journal).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS
--
-- 1. Journal (`activity_logs`, « append-only », lu par le panneau admin).
--    La règle d'insertion était `is_admin() OR auth.uid() = user_id` : tout
--    compte connecté y écrivait, sous son nom, n'importe quelle action, cible,
--    métadonnée — et n'importe quelle DATE (`created_at` venait du client).
--    Une ligne datée de 2099 restait en tête du journal et échappait à la
--    purge des 12 mois. L'admin, lui, pouvait écrire au nom de n'importe qui.
--    Le vocabulaire fermé de `logAuditAction` n'était qu'une politesse du
--    navigateur.
--
-- 2. Textes sans taille maximale. Un avis public (`engagement.body`), une
--    réaction, un message ou un titre de ticket, un panier partagé (lisible
--    par lien), une recette, un avatar (servi à tous par get_public_profiles)
--    acceptaient des mégaoctets : page de recette alourdie pour tous les
--    lecteurs, base gonflée (coût), journal pollué.
--
-- 3. Notifications : le destinataire pouvait réécrire TOUTES les colonnes de
--    ses notifications (titre, corps, lien, date d'expiration), alors que
--    l'application n'y écrit que `read_at`.
--
-- Prouvé le 2026-10-05 sur la base de production (bloc DO annulé) : voir la
-- sonde.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- Journal :
--   - un compte ordinaire n'écrit que les cinq lignes que l'application écrit
--     pour lui, chacune avec sa forme (cible, métadonnées permises) :
--       account_soft_deleted   cible 'user' = lui-même
--       recipe_submitted       cible 'recipe'
--       recipe_deleted         cible 'recipe'
--       profile_data_viewed    sans cible ; métadonnée « lang »
--       profile_data_exported  sans cible ; métadonnées « lang », « size_kb »
--   - l'admin écrit toute action, mais sous son propre nom ;
--   - l'heure est celle du serveur, quoi que le client envoie ;
--   - action en snake_case (64 caractères au plus), cible 128, type 64,
--     métadonnées 2 048 octets.
--   Les fonctions serveur (suppression RGPD, anonymisation, notifications,
--   promotion) appartiennent à `postgres`, qui passe outre les règles : elles
--   écrivent comme avant (la sonde le vérifie).
--
-- Tailles maximales (caractères, ou octets pour le JSON) :
--   engagement.body 2 000 · engagement.emoji 16
--   support_messages.content 5 000 · support_tickets.title 200, target_id 128
--   product_events.anon_id 64 · shared_baskets.payload 64 Ko
--   community_posts.recipe_id 100 · profiles.avatar_id 32, banner_id 32
--   recipes_unified : id 100, title 200, petits champs 8 à 32, motif de
--     modération 2 000 ; nom 2 Ko, description 10 Ko, ingrédients 32 Ko,
--     étapes 32 Ko, régimes 2 Ko, allergènes et étiquettes 30 au plus.
--
-- Notifications : le droit de modifier se réduit à la colonne `read_at`.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE FAIT PAS
--
-- - Le graphique du tableau de bord lit toujours le journal ligne à ligne
--   (deux ans) : l'agréger côté SQL est confié au lot 12 (ADM-11).
-- - Pas de plafond de débit sur le journal : un compte peut encore écrire
--   « profil consulté » en boucle — sous son nom, borné, et purgé à 12 mois.
-- - Les tables privées (panier, listes, restes, stock, dépenses, cuisine) ne
--   sont pas bornées ici : leurs écrivains seront relus d'abord.
--
-- COMPATIBILITÉ : toutes les lignes existantes respectent les bornes (mesuré
-- le 2026-10-05 : avis 60 caractères, message 27, titre 21, étapes 5 173
-- octets, ingrédients 2 937, nom 212). Les zones de texte ont déjà, ou reçoivent
-- avec ce lot, une longueur maximale égale ou plus courte (support : 5 000 ;
-- raison d'un accès sensible : 300 caractères, qui tiennent dans 2 048 octets).
-- Le formulaire de recette n'a pas de plafond d'étapes ni d'ingrédients, mais
-- ses bornes ne s'atteignent qu'au-delà de 54 étapes pleines en caractères de
-- 4 octets (environ 105 en français accentué) ou de 170 ingrédients (pire ligne :
-- 184 octets) ; les recettes officielles en ont au plus 6 et 13. Une
-- recette refusée garde son brouillon et l'écran le dit (lot 7c).
--
-- PREUVE : `supabase/probes/20261005_journal_et_textes_bornes.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Journal : ce qu'un compte ordinaire peut écrire ─────────────────────────
-- CASE, et pas une suite de AND : Postgres ne garantit pas l'ordre
-- d'évaluation d'un AND, et `jsonb - text[]` lève sur un scalaire.
CREATE OR REPLACE FUNCTION private.entree_de_journal_permise(
  p_user_id uuid, p_action text, p_target_id text, p_target_type text, p_metadata jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT coalesce(
    CASE p_action
      WHEN 'account_soft_deleted' THEN
        p_target_type = 'user' AND p_target_id = p_user_id::text
        AND CASE WHEN p_metadata IS NULL THEN true
                 WHEN jsonb_typeof(p_metadata) = 'object' THEN (p_metadata - ARRAY['scheduled_purge_at']) = '{}'::jsonb
                 ELSE false END
      WHEN 'recipe_submitted' THEN
        p_target_type = 'recipe' AND p_target_id IS NOT NULL AND p_metadata IS NULL
      WHEN 'recipe_deleted' THEN
        p_target_type = 'recipe' AND p_target_id IS NOT NULL AND p_metadata IS NULL
      WHEN 'profile_data_viewed' THEN
        p_target_id IS NULL AND p_target_type IS NULL
        AND CASE WHEN p_metadata IS NULL THEN true
                 WHEN jsonb_typeof(p_metadata) = 'object' THEN (p_metadata - ARRAY['lang']) = '{}'::jsonb
                 ELSE false END
      WHEN 'profile_data_exported' THEN
        p_target_id IS NULL AND p_target_type IS NULL
        AND CASE WHEN p_metadata IS NULL THEN true
                 WHEN jsonb_typeof(p_metadata) = 'object' THEN (p_metadata - ARRAY['lang', 'size_kb']) = '{}'::jsonb
                 ELSE false END
      ELSE false
    END,
    false
  );
$function$;

REVOKE ALL ON FUNCTION private.entree_de_journal_permise(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.entree_de_journal_permise(uuid, text, text, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      (SELECT public.is_admin())
      OR private.entree_de_journal_permise(user_id, action, target_id, target_type, metadata)
    )
  );

-- ── Journal : l'heure est celle du serveur ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.horodater_le_journal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.horodater_le_journal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_horodater_le_journal ON public.activity_logs;
CREATE TRIGGER trg_horodater_le_journal
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION private.horodater_le_journal();

-- ── Journal : forme et tailles ──────────────────────────────────────────────
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_action_format CHECK (action ~ '^[a-z][a-z0-9_]{1,63}$'),
  ADD CONSTRAINT activity_logs_tailles CHECK (
    char_length(target_id) <= 128
    AND char_length(target_type) <= 64
    AND octet_length(metadata::text) <= 2048
  );

-- ── Textes libres ───────────────────────────────────────────────────────────
ALTER TABLE public.engagement
  ADD CONSTRAINT engagement_body_longueur CHECK (char_length(body) <= 2000),
  ADD CONSTRAINT engagement_emoji_longueur CHECK (char_length(emoji) <= 16);

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_content_longueur CHECK (char_length(content) <= 5000);

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_title_longueur CHECK (char_length(title) <= 200),
  ADD CONSTRAINT support_tickets_target_id_longueur CHECK (char_length(target_id) <= 128);

ALTER TABLE public.product_events
  ADD CONSTRAINT product_events_anon_id_longueur CHECK (char_length(anon_id) <= 64);

ALTER TABLE public.shared_baskets
  ADD CONSTRAINT shared_baskets_payload_taille CHECK (octet_length(payload::text) <= 65536);

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_recipe_id_longueur CHECK (char_length(recipe_id) <= 100);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_id_longueur CHECK (char_length(avatar_id) <= 32),
  ADD CONSTRAINT profiles_banner_id_longueur CHECK (char_length(banner_id) <= 32);

ALTER TABLE public.recipes_unified
  ADD CONSTRAINT recipes_unified_textes_bornes CHECK (
    char_length(id) <= 100
    AND char_length(title) <= 200
    AND char_length(country) <= 8
    AND char_length(difficulty) <= 16
    AND char_length(type) <= 32
    AND char_length(status) <= 16
    AND char_length(moderation_status) <= 16
    AND char_length(ai_moderation_status) <= 32
    AND char_length(moderation_reason) <= 2000
    AND char_length(original_author_name) <= 100
    AND char_length(promoted_from_id) <= 100
    AND char_length(published_consent_version) <= 32
  ),
  ADD CONSTRAINT recipes_unified_contenus_bornes CHECK (
    octet_length(name::text) <= 2048
    AND octet_length(description::text) <= 10240
    AND octet_length(ingredients::text) <= 32768
    AND octet_length(steps::text) <= 32768
    AND octet_length(diet::text) <= 2048
    AND cardinality(allergens) <= 30
    AND cardinality(functional_tags) <= 30
    AND octet_length(array_to_string(allergens, ',')) <= 1024
    AND octet_length(array_to_string(functional_tags, ',')) <= 1024
  );

-- ── Notifications : le destinataire ne change que `read_at` ─────────────────
REVOKE UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

COMMIT;
