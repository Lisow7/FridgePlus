-- Corrige 3 anomalies signalées par l'outil Qualité admin (recipe_health_check),
-- non traitées depuis leur détection (27/06 et 08/07/2026) :
--   - oeufs-brouilles / salade-cesar : slots ingrédients sans qty structurée
--     (labels textuels déjà corrects, on ajoute juste qty:{unit,amount} en
--     s'appuyant sur les quantités déjà écrites dans les labels FR/EN).
--   - chili-con-carne : diet + allergens vides simultanément (seule recette
--     officielle dans ce cas). allergens=[] reste correct (aucun ingrédient
--     allergène), diet complété en gluten-free + dairy-free (aucun ingrédient
--     à base de blé ou de produit laitier), par analogie avec des recettes de
--     profil équivalent (ex. daube-provencale).

update recipes_unified
set ingredients = '[
  {"ids": ["fr-oeufs-standard","fr-oeufs-bio","fr-oeufs-fermier","fr-oeufs-plein-air","fr-oeufs-label-r","fr-oeufs-poules"], "qty": {"unit":"pcs","amount":4}, "labels": {"de":"4 Eier","en":"4 eggs","es":"4 huevos","fr":"4 œufs","ja":"卵4個"}, "required": true},
  {"ids": ["fr-beurre"], "qty": {"unit":"g","amount":20}, "labels": {"de":"20g Butter","en":"20g butter","es":"20g de mantequilla","fr":"20g de beurre","ja":"バター 20g"}, "required": true},
  {"ids": ["fr-creme-liquide","fr-creme-fraiche","fr-creme-epaisse"], "qty": {"unit":"cs","amount":2}, "labels": {"de":"2 EL Sahne","en":"2 tbsp cream","es":"2 c. de nata","fr":"2 c. à soupe de crème","ja":"クリーム 大さじ2"}, "required": true},
  {"ids": ["sp-sel-fin","sp-sel-gros"], "qty": {"unit":"pincée","amount":1}, "labels": {"de":"1 Prise Salz","en":"1 pinch of salt","es":"1 pizca de sal","fr":"1 pincée de sel","ja":"塩ひとつまみ"}, "required": false},
  {"ids": ["sp-poivre-noir"], "qty": {"unit":"pincée","amount":1}, "labels": {"de":"1 Prise Pfeffer","en":"1 pinch of pepper","es":"1 pizca de pimienta","fr":"1 pincée de poivre","ja":"コショウひとつまみ"}, "required": false},
  {"ids": ["fr-comte","fr-gruyere","fr-emmental"], "qty": {"unit":"g","amount":20}, "labels": {"de":"20g geriebener Käse","en":"20g grated cheese","es":"20g de queso rallado","fr":"20g de fromage râpé","ja":"すりおろしチーズ 20g"}, "required": false}
]'::jsonb
where id = 'oeufs-brouilles'
  and exists (select 1 from jsonb_array_elements(ingredients) e where e->'qty' is null);

update recipes_unified
set ingredients = '[
  {"ids": ["vg-salade-verte","vg-laitue","vg-endives"], "qty": {"unit":"g","amount":150}, "labels": {"de":"150g Romanasalat","en":"150g romaine / lettuce","es":"150g de lechuga romana","fr":"150g de romaine / laitue","ja":"ロメインレタス 150g"}, "required": true},
  {"ids": ["fr-parmesan","fr-grana-padano"], "qty": {"unit":"g","amount":30}, "labels": {"de":"30g geriebener Parmesan","en":"30g grated parmesan","es":"30g de parmesano rallado","fr":"30g de parmesan râpé","ja":"パルメザン（すりおろし）30g"}, "required": true},
  {"ids": ["fr-creme-fraiche","fr-creme-liquide","fr-mascarpone"], "qty": {"unit":"cs","amount":2}, "labels": {"de":"2 EL Crème fraîche","en":"2 tbsp crème fraîche","es":"2 c. de crema fresca","fr":"2 c. à soupe de crème fraîche","ja":"クレームフレッシュ 大さじ2"}, "required": true},
  {"ids": ["vg-ail"], "qty": {"unit":"gousse","amount":1}, "labels": {"de":"1 Knoblauchzehe","en":"1 garlic clove","es":"1 diente de ajo","fr":"1 gousse d''ail","ja":"にんにく1片"}, "required": true},
  {"ids": ["fr-citron"], "qty": {"unit":"pcs","amount":0.5}, "labels": {"de":"½ Zitrone (Saft)","en":"½ lemon (juice)","es":"½ limón (zumo)","fr":"½ citron (jus)","ja":"レモン½個（果汁）"}, "required": false},
  {"ids": ["gp-croûtons","gp-biscuits-sale"], "qty": {"unit":"g","amount":50}, "labels": {"de":"50g Croutons","en":"50g croutons","es":"50g de picatostes","fr":"50g de croûtons","ja":"クルトン 50g"}, "required": false},
  {"ids": ["gp-anchois"], "qty": {"unit":"pcs","amount":2}, "labels": {"en":"2 anchovies","fr":"2 anchois"}, "required": false},
  {"ids": ["sp-mayonnaise"], "qty": {"unit":"cs","amount":2}, "labels": {"en":"2 tbsp mayonnaise","fr":"2 c. à soupe de mayonnaise"}, "required": false},
  {"ids": ["sp-worcestershire"], "qty": {"unit":"cc","amount":1}, "labels": {"en":"1 tsp Worcestershire sauce","fr":"1 c. à café de sauce Worcestershire"}, "required": false}
]'::jsonb
where id = 'salade-cesar'
  and exists (select 1 from jsonb_array_elements(ingredients) e where e->'qty' is null);

update recipes_unified
set diet = '["gluten-free","dairy-free"]'::jsonb
where id = 'chili-con-carne'
  and coalesce(jsonb_array_length(diet), 0) = 0
  and coalesce(cardinality(allergens), 0) = 0;
