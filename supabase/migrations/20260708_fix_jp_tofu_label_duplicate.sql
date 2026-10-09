-- Corrige le doublon de label FR "Tofu" entre vg-tofu et jp-tofu
-- (flag "Label FR en doublon" de l'outil Qualité admin, signalé depuis le 19/05/2026).
-- jp-tofu est le tofu générique de la section japonaise (parent de groupe pour
-- jp-kimomen-tofu/ferme, jp-kinu-tofu/soyeux, etc.) — renommé "Tofu nature" / "Plain tofu"
-- pour le distinguer de vg-tofu sans changer son id (aucune recette ne référence jp-tofu).
update ingredients
set labels = jsonb_set(labels, '{fr}', '"Tofu nature"') || jsonb_build_object('en', 'Plain tofu')
where id = 'jp-tofu'
  and labels->>'fr' = 'Tofu';
