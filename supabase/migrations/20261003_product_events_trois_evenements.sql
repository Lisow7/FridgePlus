-- Trois événements de plus pour comprendre où les visiteurs décrochent
-- (audit d'intuitivité du 2026-10-02, décision d'Antoine du 2026-10-03).
-- Usage réel : 35 visiteurs ouvrent une recette, 3 la cuisinent — avec les
-- 4 événements d'origine, impossible de dire où se perd le reste.
--
--   ingredient_search  — une recherche d'aliment aboutie (props : nombre de
--                        résultats, JAMAIS le texte tapé)
--   recipe_steps_seen  — la fiche a été lue jusqu'aux étapes
--   cook_started       — toucher « J'ai cuisiné » (cook_completed = confirmé)
--
-- Toujours soumis au consentement « audience » côté client (track.js).
-- Purement additif : la liste s'élargit, aucune ligne existante n'est touchée.
-- NOT VALID puis VALIDATE : la vérification des lignes existantes ne prend
-- pas le verrou exclusif de l'ALTER (table minuscule, mais bon réflexe).
begin;

alter table public.product_events
  drop constraint if exists product_events_event_chk;

alter table public.product_events
  add constraint product_events_event_chk check (event in (
    'ingredient_added', 'cookable_recipe_viewed', 'recipe_opened', 'cook_completed',
    'ingredient_search', 'recipe_steps_seen', 'cook_started'
  )) not valid;

alter table public.product_events
  validate constraint product_events_event_chk;

commit;
