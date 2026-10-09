-- Etend la couverture de 3 tags fonctionnels (anti_waste, kids_friendly, batch_cooking)
-- identifies par une passe editoriale sur les 355 recettes
-- qui n'avaient aucun des 3 tags. Perimetre et methode : voir
-- la conception « functional-tags-coverage » du 2026-07-08.
--
-- functional_tags vit sur recipes_unified (table reelle ; base_recipes = VUE).
-- Idempotent : n'ajoute chaque tag que s'il est absent, preserve les tags existants
-- (freezer_friendly notamment, deja peuple a 170/501 par la migration precedente).
-- 57 anti_waste, 112 kids_friendly, 44 batch_cooking ajoutes par cette migration.

update recipes_unified
set functional_tags = array_append(functional_tags, 'anti_waste')
where origin = 'official'
  and not (functional_tags @> array['anti_waste'])
  and id = any(array[
    'bibimbap','bruschetta-tomate','bruschetta-champignons','banana-bread','chili-con-carne','chow-mein-boeuf',
    'compote-pommes','crumble-fruits','curry-legumes','curry-pois-chiches','dahl-lentilles-coco','espinacas-garbanzos',
    'frittata-legumes','gaspacho','hachis-parmentier','houmous','houmous-betterave','kimchi-jjigae',
    'lentilles-vinaigrette','nouilles-sautees-legumes','nouilles-sautees-vietnamiennes','pain-perdu','panzanella','patatas-bravas',
    'patates-douces-roties','patates-grecques-citron','poele-legumes','pois-chiches-epices','potage-saint-germain','poulet-basquaise',
    'puree-patate-douce','puree-pommes-terre','quiche-legumes','risotto-legumes','salade-haricots-blancs','salade-lentilles',
    'salade-pommes-de-terre','salade-thon-haricots','samoussas-legumes','saucisses-lentilles','soupe-legumes','soupe-lentilles-coral',
    'soupe-oignon','soupe-tomate-basilic','tartiflette','tian-provencal','tofu-kimchi','tortilla-espagnole',
    'tostadas-haricots','wok-crevettes-legumes','wok-poulet-legumes','yakisoba','gratin-dauphinois','frites-au-four',
    'pommes-terre-sautees','ratatouille','riz-cantonais'
  ]);

update recipes_unified
set functional_tags = array_append(functional_tags, 'kids_friendly')
where origin = 'official'
  and not (functional_tags @> array['kids_friendly'])
  and id = any(array[
    'baklava','banana-bread','brownie','cake-citron','cake-marbre','cannoli',
    'carrot-cake','cheesecake','clafoutis','compote-pommes','cookies-chocolat','cornes-gazelle',
    'crema-catalana','creme-brulee','crepes','crepes-suzette','crumble-fruits','eclairs-chocolat',
    'energy-balls','far-breton','financiers','flan-mexicain','flan-patissier','fondant-chocolat',
    'gateau-yaourt','gaufres','granola-maison','ile-flottante','key-lime-pie','kheer',
    'madeleines','mousse-chocolat','mousse-citron','muffins-choco','mug-cake-chocolat','pain-d-epices',
    'pain-perdu','pancakes','panna-cotta','porridge-avoine','profiteroles','pumpkin-pie',
    'quatre-quarts','riz-au-lait','salade-de-fruits','smoothie-fraise','tarta-santiago','tarte-chocolat',
    'tarte-citron','tarte-fraises','tarte-pommes','tarte-tatin','torta-caprese','arancini',
    'bbq-ribs','boulettes-sauce-tomate','burger-maison','burritos-boeuf','burritos-haricots','carbonara',
    'club-sandwich','croque-madame','croque-monsieur','croquetas-jambon','escalope-milanaise','fajitas-legumes',
    'fajitas-poulet','frites-au-four','gratin-dauphinois','gratin-pates','gyros-poulet','gyudon',
    'hachis-parmentier','katsudon','lasagnes-bolognaise','nachos-gratines','nems','omelette-fromage',
    'onion-rings','pates-jambon','pates-saumon','pates-tomate','patates-douces-roties','patates-grecques-citron',
    'philly-cheesesteak','pizza-maison','polenta-cremeuse','pommes-terre-sautees','poulet-citron','poulet-herbes',
    'poulet-roti','poulet-sesame','puree-carottes','puree-patate-douce','puree-pommes-terre','quiche-legumes',
    'quiche-lorraine','quiche-saumon-epinards','saganaki','samoussas-legumes','saumon-miel-moutarde','saumon-teriyaki',
    'saute-porc-caramel','spaghetti-bolognaise','spaghetti-cacio-e-pepe','tacos-poisson','tamagoyaki','tonkatsu',
    'tortilla-espagnole','tostadas-haricots','travers-porc-hoisin','wrap-poulet'
  ]);

update recipes_unified
set functional_tags = array_append(functional_tags, 'batch_cooking')
where origin = 'official'
  and not (functional_tags @> array['batch_cooking'])
  and id = any(array[
    'aubergines-parmesan','blanquette-poulet','blanquette-veau','boeuf-bourguignon','boeuf-carottes','burritos-boeuf',
    'burritos-haricots','couscous-poulet','curry-legumes','curry-pois-chiches','curry-vert-poulet-thai','dahl-lentilles-coco',
    'gratin-pates','hachis-parmentier','kimchi-jjigae','korma-poulet','lapin-moutarde','lasagnes-bolognaise',
    'mapo-tofu','paella','poulet-basquaise','poulet-curry-coco','ratatouille','saucisses-lentilles',
    'soupe-legumes','soupe-lentilles-coral','soupe-oignon','soupe-potiron','soupe-tomate-basilic','soupe-tom-kha',
    'soupe-vermicelles-poulet','spaghetti-bolognaise','tajine-poulet','tartiflette','travers-porc-hoisin','bbq-ribs',
    'veloute-asperges','veloute-brocoli','veloute-butternut','veloute-carottes-gingembre','veloute-champignons','veloute-petits-pois',
    'veloute-poireaux','potage-saint-germain'
  ]);
