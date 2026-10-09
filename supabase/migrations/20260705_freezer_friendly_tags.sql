-- Ajoute le tag fonctionnel `freezer_friendly` (« Congélation OK ») à 150 recettes
-- qui se congèlent bien, identifiées par une passe éditoriale (calendrier ADEME + recherches ciblées quiche/cheesecake).
--
-- Contexte : seulement 6 recettes étaient taggées → le filtre « Congélation OK »
-- était quasi vide (6/501). Cette passe couvre pâtisseries denses, mijotés/ragoûts,
-- currys/dahls, gratins/lasagnes, soupes/veloutés, purées, pains, dips épais.
-- Exclus (texture ruinée au dégel) : salades crues, fritures servies minute,
-- risottos, pâtes fraîches al dente, fruits de mer, custards type flan, œufs minute.
--
-- `functional_tags` vit sur `recipes_unified` (table réelle ; base_recipes = VUE).
-- Idempotent : n'ajoute le tag que s'il est absent, préserve les tags existants
-- (batch_cooking, anti_waste, kids_friendly…).

update recipes_unified
set functional_tags = array_append(functional_tags, 'freezer_friendly')
where origin = 'official'
  and not (functional_tags @> array['freezer_friendly'])
  and id = any(array[
    'baklava','banana-bread','blueberry-muffins','brownie','cake-citron','cake-marbre',
    'carrot-cake','cheesecake','cinnamon-rolls','clafoutis','compote-poire-vanille',
    'compote-pommes','cookies-avoine-raisins','cookies-chocolat','cornes-gazelle','crepes',
    'crumble-fruits','crumble-pommes-avoine','far-breton','financiers','fondant-chocolat',
    'gateau-banane-chocolat','gateau-yaourt','gaufres','key-lime-pie','madeleines',
    'muffins-choco','pain-d-epices','pain-perdu','pancakes','pancakes-banane',
    'peanut-butter-cookies','pumpkin-pie','quatre-quarts','tarta-santiago','tarte-chocolat',
    'tarte-citron','tarte-poire-chocolat','tarte-pommes','tarte-tatin','torta-caprese',
    'agneau-four-grec','agneau-rogan-josh','albondigas','aubergines-parmesan','bacalao-tomate',
    'biryani-legumes','blanquette-poulet','blanquette-veau','boeuf-bourguignon','boeuf-carottes',
    'boeuf-stroganoff','boulettes-sauce-tomate','boulettes-vegetariennes','brandade-morue',
    'cannelloni-ricotta-epinards','cassoulet','chili-con-carne','chili-patate-douce',
    'chili-sin-carne','chou-farci','choucroute-garnie','coq-au-vin','couscous-merguez',
    'couscous-poulet','curry-legumes','curry-pois-chiches','curry-rouge-tofu-thai',
    'curry-vert-poulet-thai','dahl-epinards','dahl-lentilles-coco','dal-makhani',
    'daube-provencale','enchiladas-poulet','fabada-asturiana','gemista','gigantes-plaki',
    'gratin-endives-jambon','gratin-macaroni','gratin-pates','gumbo','hachis-parmentier',
    'jambalaya','keftedes','kimchi-jjigae','korma-poulet','lapin-moutarde','lasagnes-bolognaise',
    'lasagnes-legumes','lentejas-chorizo','mac-and-cheese','meatloaf','moussaka','mujaddara',
    'navarin-agneau','nikujaga','osso-buco','pastilla-poulet','pastitsio','pollo-chilindron',
    'poulet-basquaise','poulet-curry-coco','poulet-tikka-masala','quiche-legumes',
    'quiche-lorraine','quiche-saumon-epinards','saucisses-lentilles','spanakopita',
    'tajine-agneau-pruneaux','tajine-legumes','tajine-poulet','tinga-poulet','tofu-curry-coco',
    'briam','caponata','chou-rouge-braise','cornbread','escalivada','focaccia','gratin-butternut',
    'gratin-chou-fleur','gratin-courgettes','gratin-dauphinois','gratin-poireaux','msemen','naan',
    'pisto-manchego','puree-carottes','puree-celeri-rave','puree-patate-douce','puree-pois-casses',
    'puree-pommes-terre','ratatouille','zaalouk','caviar-aubergine','fasolada','frijoles-refritos',
    'harira','houmous','houmous-betterave','minestrone','moutabal','potage-saint-germain',
    'ribollita','soupe-courge-coco','soupe-haricots-noirs','soupe-legumes','soupe-lentilles-coral',
    'soupe-lentilles-curry','soupe-mais-poulet','soupe-oignon','soupe-pois-chiches','soupe-potiron',
    'soupe-tom-kha','soupe-tomate-basilic','soupe-vermicelles-poulet','veloute-asperges',
    'veloute-brocoli','veloute-butternut','veloute-carottes-gingembre','veloute-champignons',
    'veloute-petits-pois','veloute-poireaux','veloute-tomate-roti'
  ]);
