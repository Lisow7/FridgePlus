-- Fix bug : ré-avis (ou toute reprise d'écriture) sur une ligne `engagement`
-- auto-supprimée (soft-delete) échouait en 403 RLS ("new row violates row-level
-- security policy (USING expression) for table \"engagement\"") — visible
-- directement dans le formulaire d'avis recette côté utilisateur.
--
-- Cause : la policy `engagement_update` exigeait `deleted_at IS NULL` pour
-- autoriser l'auteur à modifier sa ligne. Un ON CONFLICT ... DO UPDATE
-- (upsertReview, reactToPost, etc.) qui retombe sur une ligne soft-deleted
-- par SON PROPRE auteur se voit donc bloqué au même titre qu'une ligne
-- supprimée par un admin pour modération — alors que ces deux cas doivent
-- être distingués : l'auto-suppression doit rester réversible par une
-- nouvelle écriture (qui repasse par la modération existante), la
-- suppression admin ne doit PAS être contournable par l'auteur.
--
-- Preuve que `deleted_at IS NULL` était une incohérence de migration (pas
-- une décision voulue) : les tables sœurs community_posts et
-- community_replies utilisent déjà `deleted_by_admin = false` pour ce même
-- besoin — le commentaire de src/features/admin/api/recipe-reviews-admin.js
-- ("la policy UPDATE auteur exige deleted_by_admin = false") décrivait déjà
-- le comportement attendu, jamais appliqué à `engagement`.
--
-- Le code client (upsertReview) remet en plus explicitement `deleted_at` à
-- null dans le payload — sans quoi la ligne redeviendrait modifiable mais
-- resterait invisible/non comptabilisée pour tout le monde sauf l'auteur.

drop policy "engagement_update" on public.engagement;

create policy "engagement_update" on public.engagement
for update
using (is_admin() or (auth.uid() = user_id and deleted_by_admin = false))
with check (is_admin() or auth.uid() = user_id);
