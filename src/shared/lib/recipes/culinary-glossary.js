// Glossaire culinaire statique (FR + EN). Pur, synchrone, zéro BDD/PII.
//
// Chaque entrée : { id, def: { fr, en }, match: { fr: [formes], en: [formes] } }
// `match` = formes (canonique + conjugaisons/variantes) par langue ; le matching
// se fait sur la langue d'affichage des étapes. Termes choisis pour être
// quasi univoques en contexte de recette (faux positifs minimisés).

export const CULINARY_GLOSSARY = [
  { id: 'emincer', def: { fr: 'Couper en tranches très fines.', en: 'Cut into very thin slices.' },
    match: { fr: ['émincer', 'émincez', 'émincé', 'émincée', 'émincés', 'émincées', 'émince'], en: ['mince', 'finely slice'] } },
  { id: 'ciseler', def: { fr: 'Couper en tout petits dés (herbes, oignon).', en: 'Cut into tiny dice (herbs, onion).' },
    match: { fr: ['ciseler', 'ciselez', 'ciselé', 'ciselée', 'ciselés', 'cisèle'], en: ['finely chop'] } },
  { id: 'hacher', def: { fr: 'Couper en très petits morceaux irréguliers.', en: 'Chop into small irregular pieces.' },
    match: { fr: ['hacher', 'hachez', 'haché', 'hachée', 'hachés', 'hachées'], en: ['chop', 'mince'] } },
  { id: 'concasser', def: { fr: 'Hacher grossièrement (souvent tomates).', en: 'Coarsely crush or chop (often tomatoes).' },
    match: { fr: ['concasser', 'concassez', 'concassé', 'concassée', 'concassés'], en: ['crush', 'coarsely chop'] } },
  { id: 'blanchir', def: { fr: 'Plonger brièvement dans l’eau bouillante puis refroidir.', en: 'Briefly boil then cool down.' },
    match: { fr: ['blanchir', 'blanchissez', 'blanchi', 'blanchie', 'blanchis'], en: ['blanch'] } },
  { id: 'deglacer', def: { fr: 'Dissoudre les sucs au fond de la poêle avec un liquide.', en: 'Dissolve pan juices with a liquid.' },
    match: { fr: ['déglacer', 'déglacez', 'déglacé', 'déglacée', 'déglace'], en: ['deglaze'] } },
  { id: 'monder', def: { fr: 'Retirer la peau après un passage à l’eau bouillante.', en: 'Remove the skin after blanching.' },
    match: { fr: ['monder', 'mondez', 'mondé', 'mondée', 'mondés'], en: ['blanch and peel'] } },
  { id: 'suer', def: { fr: 'Cuire doucement sans coloration pour rendre l’eau.', en: 'Cook gently without coloring to release moisture.' },
    match: { fr: ['faire suer', 'suer', 'suez', 'sué'], en: ['sweat'] } },
  { id: 'revenir', def: { fr: 'Cuire à feu vif dans un corps gras pour colorer.', en: 'Sauté in fat to brown.' },
    match: { fr: ['faire revenir', 'revenir'], en: ['sauté', 'saute'] } },
  { id: 'reduire', def: { fr: 'Faire évaporer un liquide pour le concentrer.', en: 'Simmer a liquid to concentrate it.' },
    match: { fr: ['réduire', 'réduisez', 'réduit', 'réduite', 'réduits'], en: ['reduce'] } },
  { id: 'napper', def: { fr: 'Recouvrir d’une fine couche de sauce.', en: 'Coat with a thin layer of sauce.' },
    match: { fr: ['napper', 'nappez', 'nappé', 'nappée', 'nappe'], en: ['coat'] } },
  { id: 'chemiser', def: { fr: 'Tapisser un moule (papier, beurre, sucre…).', en: 'Line a mold (paper, butter, sugar…).' },
    match: { fr: ['chemiser', 'chemisez', 'chemisé', 'chemisée'], en: ['line the mold'] } },
  { id: 'cuire-a-blanc', def: { fr: 'Cuire une pâte à vide, sans garniture.', en: 'Bake a crust empty, without filling.' },
    match: { fr: ['cuire à blanc', 'cuisson à blanc'], en: ['bake blind', 'blind bake'] } },
  { id: 'bain-marie', def: { fr: 'Chauffer un récipient posé dans un autre rempli d’eau chaude.', en: 'Heat a container set in another filled with hot water.' },
    match: { fr: ['bain-marie'], en: ['bain-marie', 'water bath'] } },
  { id: 'julienne', def: { fr: 'Découpe en fins bâtonnets.', en: 'Cut into thin matchsticks.' },
    match: { fr: ['julienne'], en: ['julienne'] } },
  { id: 'brunoise', def: { fr: 'Découpe en tout petits dés réguliers.', en: 'Cut into small even dice.' },
    match: { fr: ['brunoise'], en: ['brunoise'] } },
  { id: 'zester', def: { fr: 'Prélever la partie colorée de la peau d’un agrume.', en: 'Grate the colored peel of a citrus.' },
    match: { fr: ['zester', 'zestez', 'zesté', 'zeste'], en: ['zest'] } },
  { id: 'mijoter', def: { fr: 'Cuire à petits frémissements, à feu doux.', en: 'Cook gently at a low simmer.' },
    match: { fr: ['mijoter', 'mijotez', 'mijoté', 'mijotée', 'mijote'], en: ['simmer'] } },
  { id: 'saisir', def: { fr: 'Cuire à feu vif pour colorer rapidement la surface.', en: 'Cook over high heat to quickly color the surface.' },
    match: { fr: ['saisir', 'saisissez', 'saisi', 'saisie'], en: ['sear'] } },
  { id: 'paner', def: { fr: 'Enrober de chapelure avant cuisson.', en: 'Coat with breadcrumbs before cooking.' },
    match: { fr: ['paner', 'panez', 'pané', 'panée', 'panés'], en: ['bread', 'coat with breadcrumbs'] } },
  { id: 'fariner', def: { fr: 'Enrober légèrement de farine.', en: 'Lightly coat with flour.' },
    match: { fr: ['fariner', 'farinez', 'fariné', 'farinée'], en: ['dredge in flour', 'flour'] } },
  { id: 'degraisser', def: { fr: 'Retirer l’excès de gras d’un bouillon ou d’une viande.', en: 'Remove excess fat from a stock or meat.' },
    match: { fr: ['dégraisser', 'dégraissez', 'dégraissé'], en: ['skim the fat', 'degrease'] } },
  { id: 'dresser', def: { fr: 'Disposer harmonieusement dans l’assiette.', en: 'Arrange neatly on the plate.' },
    match: { fr: ['dresser', 'dressez', 'dressé', 'dressée'], en: ['plate up'] } },
  { id: 'clarifier', def: { fr: 'Rendre un liquide limpide (ou séparer le beurre).', en: 'Make a liquid clear (or separate butter).' },
    match: { fr: ['clarifier', 'clarifiez', 'clarifié', 'clarifiée'], en: ['clarify'] } },
  { id: 'abaisser', def: { fr: 'Étaler une pâte au rouleau à l’épaisseur voulue.', en: 'Roll out dough to the desired thickness.' },
    match: { fr: ['abaisser', 'abaissez', 'abaissé', 'abaissée'], en: ['roll out'] } },
  { id: 'foncer', def: { fr: 'Garnir un moule avec une pâte abaissée.', en: 'Line a mold with rolled-out dough.' },
    match: { fr: ['foncer', 'foncez', 'foncé un moule'], en: ['line with dough'] } },
  { id: 'pocher', def: { fr: 'Cuire dans un liquide frémissant, sans ébullition.', en: 'Cook in barely simmering liquid.' },
    match: { fr: ['pocher', 'pochez', 'poché', 'pochée', 'pochés'], en: ['poach'] } },
  { id: 'braiser', def: { fr: 'Cuire lentement à couvert avec peu de liquide.', en: 'Cook slowly, covered, with a little liquid.' },
    match: { fr: ['braiser', 'braisez', 'braisé', 'braisée', 'braisés'], en: ['braise'] } },
  { id: 'rissoler', def: { fr: 'Dorer dans un corps gras à feu vif.', en: 'Brown in fat over high heat.' },
    match: { fr: ['rissoler', 'rissolez', 'rissolé', 'rissolée'], en: ['brown'] } },
  { id: 'carameliser', def: { fr: 'Chauffer du sucre jusqu’à coloration, ou colorer un aliment.', en: 'Heat sugar until it colors, or brown a food.' },
    match: { fr: ['caraméliser', 'caramélisez', 'caramélisé', 'caramélisée'], en: ['caramelize', 'caramelise'] } },
  { id: 'emulsionner', def: { fr: 'Mélanger deux liquides non miscibles en une texture homogène.', en: 'Blend two non-mixable liquids into a smooth texture.' },
    match: { fr: ['émulsionner', 'émulsionnez', 'émulsionné', 'émulsionnée'], en: ['emulsify'] } },
  { id: 'incorporer', def: { fr: 'Ajouter délicatement un ingrédient à une préparation.', en: 'Gently fold an ingredient into a mixture.' },
    match: { fr: ['incorporer', 'incorporez', 'incorporé', 'incorporée'], en: ['fold in'] } },
  { id: 'degorger', def: { fr: 'Faire rendre l’eau ou les impuretés (sel, trempage).', en: 'Draw out water or impurities (salt, soaking).' },
    match: { fr: ['dégorger', 'dégorgez', 'dégorgé'], en: ['disgorge', 'salt and drain'] } },
  { id: 'blondir', def: { fr: 'Cuire doucement jusqu’à une légère coloration dorée.', en: 'Cook gently until lightly golden.' },
    match: { fr: ['blondir', 'blondissez', 'blondi'], en: ['cook until golden'] } },
  { id: 'debarrasser', def: { fr: 'Transvaser une préparation hors du feu/récipient.', en: 'Transfer a preparation out of the pan.' },
    match: { fr: ['débarrasser', 'débarrassez', 'débarrassé'], en: ['transfer out'] } },

  // ── Extension #5 (2026-07-01) : couverture élargie pour qu'un débutant ne
  //    soit jamais bloqué par un terme. Verbes triviaux (couper, mélanger,
  //    verser, saler, cuire…) volontairement exclus (pas du jargon). ──
  { id: 'dorer', def: { fr: 'Colorer la surface en doré dans un corps gras chaud (« faire dorer »).', en: 'Brown the surface to golden in hot fat.' },
    match: { fr: ['dorer', 'dorez', 'doré', 'dorée', 'dorés', 'dorées', 'faire dorer'], en: ['golden brown', 'brown until golden'] } },
  { id: 'egoutter', def: { fr: 'Éliminer l’eau en versant dans une passoire.', en: 'Drain off the water in a colander.' },
    match: { fr: ['égoutter', 'égouttez', 'égoutté', 'égouttée', 'égouttés', 'égouttées'], en: ['drain'] } },
  { id: 'parsemer', def: { fr: 'Répartir un ingrédient en petites touches sur un plat.', en: 'Scatter small bits over a dish.' },
    match: { fr: ['parsemer', 'parsemez', 'parsemé', 'parsemée', 'parsemés'], en: ['scatter'] } },
  { id: 'saupoudrer', def: { fr: 'Répartir une fine pluie de poudre (sucre, farine, cacao).', en: 'Dust a fine layer of powder over food.' },
    match: { fr: ['saupoudrer', 'saupoudrez', 'saupoudré', 'saupoudrée'], en: ['dust with'] } },
  // Note : la forme nom « assaisonnement » est volontairement absente → dans
  // « rectifier l’assaisonnement », seul « rectifier » est marqué (sa définition
  // couvre déjà l’assaisonnement) au lieu d’un double surlignage.
  { id: 'assaisonner', def: { fr: 'Ajouter sel, poivre et épices pour relever le goût.', en: 'Add salt, pepper and spices to bring out flavor.' },
    match: { fr: ['assaisonner', 'assaisonnez', 'assaisonné', 'assaisonnée'], en: ['season', 'seasoning'] } },
  { id: 'rectifier', def: { fr: 'Corriger l’assaisonnement en goûtant (sel, acidité…).', en: 'Adjust the seasoning to taste.' },
    match: { fr: ['rectifier', 'rectifiez', 'rectifié', 'rectifiée'], en: ['adjust the seasoning'] } },
  { id: 'fondre', def: { fr: 'Rendre liquide sous l’effet de la chaleur (« faire fondre »).', en: 'Melt with heat.' },
    match: { fr: ['faire fondre', 'fondre', 'fondu', 'fondue'], en: ['melt', 'melted'] } },
  { id: 'arroser', def: { fr: 'Verser régulièrement le jus ou le gras sur une pièce en cuisson.', en: 'Spoon the juices or fat over food as it cooks (baste).' },
    match: { fr: ['arroser', 'arrosez', 'arrosé', 'arrosée'], en: ['baste'] } },
  { id: 'mixer', def: { fr: 'Réduire en purée ou en liquide au mixeur.', en: 'Blend to a purée or a smooth liquid.' },
    match: { fr: ['mixer', 'mixez', 'mixé', 'mixée'], en: ['blend', 'blend until smooth'] } },
  { id: 'reserver', def: { fr: 'Mettre de côté un aliment pour l’utiliser plus tard.', en: 'Set aside for later use.' },
    match: { fr: ['réserver', 'réservez', 'réservé', 'réservée'], en: ['set aside'] } },
  { id: 'sauter', def: { fr: 'Cuire à feu vif en faisant sauter dans un peu de gras.', en: 'Cook quickly over high heat, tossing, in a little fat.' },
    match: { fr: ['faire sauter', 'sauter', 'sautez', 'sauté', 'sautée', 'sautés'], en: ['toss in the pan', 'stir-fry'] } },
  { id: 'garnir', def: { fr: 'Remplir ou décorer un plat avec un accompagnement.', en: 'Fill or top a dish.' },
    match: { fr: ['garnir', 'garnissez', 'garni', 'garnie'], en: ['top with', 'garnish'] } },
  // Terme composé : doit primer sur « garni » (verbe garnir). Le matcher trie par
  // longueur décroissante → « bouquet garni » gagne quand il précède « garni ».
  { id: 'bouquet-garni', def: { fr: 'Petit bouquet d’herbes aromatiques (thym, laurier, persil) ficelé, retiré en fin de cuisson.', en: 'A tied bundle of aromatic herbs (thyme, bay, parsley), removed after cooking.' },
    match: { fr: ['bouquet garni'], en: ['bouquet garni'] } },
  { id: 'disposer', def: { fr: 'Placer harmonieusement les éléments dans l’assiette.', en: 'Arrange the elements neatly.' },
    match: { fr: ['disposer', 'disposez', 'disposé', 'disposée'], en: ['arrange'] } },
  { id: 'refroidir', def: { fr: 'Laisser revenir à température ambiante ou plus froid.', en: 'Let cool down.' },
    match: { fr: ['refroidir', 'refroidissez', 'refroidi', 'refroidie', 'faire refroidir'], en: ['cool down', 'let cool'] } },
  { id: 'tiedir', def: { fr: 'Amener à une température juste tiède.', en: 'Bring to lukewarm.' },
    match: { fr: ['tiédir', 'tiédissez', 'tiédi', 'faire tiédir'], en: ['warm to lukewarm'] } },
  { id: 'refrigerer', def: { fr: 'Placer au réfrigérateur pour refroidir.', en: 'Chill in the fridge.' },
    match: { fr: ['réfrigérer', 'réfrigérez', 'réfrigéré', 'réfrigérée'], en: ['refrigerate', 'chill'] } },
  { id: 'mariner', def: { fr: 'Laisser tremper dans un mélange aromatique pour parfumer.', en: 'Soak in a seasoned mixture to flavor.' },
    match: { fr: ['mariner', 'marinez', 'mariné', 'marinée', 'marinés'], en: ['marinate'] } },
  { id: 'etaler', def: { fr: 'Répartir en couche régulière (pâte, garniture).', en: 'Spread into an even layer.' },
    match: { fr: ['étaler', 'étalez', 'étalé', 'étalée'], en: ['spread out'] } },
  { id: 'battre', def: { fr: 'Mélanger vigoureusement pour aérer ou homogénéiser.', en: 'Beat vigorously to aerate or blend.' },
    match: { fr: ['battre', 'battez', 'battu', 'battue', 'battus'], en: ['beat'] } },
  { id: 'fouetter', def: { fr: 'Battre vivement au fouet pour aérer.', en: 'Whisk briskly to aerate.' },
    match: { fr: ['fouetter', 'fouettez', 'fouetté', 'fouettée'], en: ['whisk'] } },
  { id: 'ecraser', def: { fr: 'Réduire en purée grossière (fourchette, presse-purée).', en: 'Mash coarsely.' },
    match: { fr: ['écraser', 'écrasez', 'écrasé', 'écrasée', 'écrasés'], en: ['mash'] } },
  { id: 'eplucher', def: { fr: 'Retirer la peau d’un fruit ou d’un légume.', en: 'Peel off the skin.' },
    match: { fr: ['éplucher', 'épluchez', 'épluché', 'épluchée', 'peler', 'pelez', 'pelé', 'pelée'], en: ['peel', 'peel off'] } },
  { id: 'raper', def: { fr: 'Réduire en fins morceaux à l’aide d’une râpe.', en: 'Grate into fine shreds.' },
    match: { fr: ['râper', 'râpez', 'râpé', 'râpée', 'râpés', 'râpées'], en: ['grate', 'grated'] } },
  { id: 'rotir', def: { fr: 'Cuire au four ou à la broche avec un corps gras.', en: 'Roast in the oven or on a spit.' },
    match: { fr: ['rôtir', 'rôtissez', 'rôti', 'rôtie', 'rôtis'], en: ['roast', 'roasted'] } },
  { id: 'frire', def: { fr: 'Cuire par immersion dans un bain de matière grasse chaude.', en: 'Deep-fry in hot fat.' },
    match: { fr: ['frire', 'faire frire', 'frit', 'frite', 'frits'], en: ['deep-fry'] } },
  { id: 'enfourner', def: { fr: 'Mettre au four.', en: 'Put into the oven.' },
    match: { fr: ['enfourner', 'enfournez', 'enfourné'], en: ['put in the oven'] } },
  { id: 'prechauffer', def: { fr: 'Chauffer le four à l’avance à la température voulue.', en: 'Preheat the oven to the target temperature.' },
    match: { fr: ['préchauffer', 'préchauffez', 'préchauffé'], en: ['preheat'] } },
  { id: 'rincer', def: { fr: 'Passer sous l’eau claire pour nettoyer.', en: 'Rinse under clean water.' },
    match: { fr: ['rincer', 'rincez', 'rincé', 'rincée'], en: ['rinse'] } },
  { id: 'porter-ebullition', def: { fr: 'Chauffer un liquide jusqu’aux gros bouillons.', en: 'Bring a liquid to a rolling boil.' },
    match: { fr: ['porter à ébullition', 'portez à ébullition', 'à ébullition', 'ébullition'], en: ['bring to a boil', 'bring to the boil'] } },
  { id: 'reposer', def: { fr: 'Laisser la préparation au repos (pâte qui lève, viande qui se détend).', en: 'Let the preparation rest.' },
    match: { fr: ['laisser reposer', 'reposer', 'reposez'], en: ['let it rest', 'let rest'] } },
  { id: 'griller', def: { fr: 'Cuire ou colorer à chaleur vive et sèche.', en: 'Cook or toast with dry high heat.' },
    match: { fr: ['griller', 'grillez', 'grillé', 'grillée', 'grillés'], en: ['grill', 'toast', 'toasted'] } },
  { id: 'gratiner', def: { fr: 'Dorer le dessus au four (fromage, chapelure).', en: 'Brown the top in the oven with cheese or breadcrumbs.' },
    match: { fr: ['gratiner', 'gratinez', 'gratiné', 'gratinée'], en: ['gratin', 'brown on top'] } },
  { id: 'enrober', def: { fr: 'Recouvrir entièrement d’une couche (sauce, chapelure).', en: 'Coat all over with a layer.' },
    match: { fr: ['enrober', 'enrobez', 'enrobé', 'enrobée'], en: ['coat all over'] } },
  { id: 'fremir', def: { fr: 'Cuire juste sous l’ébullition, à petits frémissements.', en: 'Cook just below boiling, barely bubbling.' },
    match: { fr: ['frémir', 'frémissez', 'frémissement', 'frémit', 'à frémissement'], en: ['barely simmer'] } },
  { id: 'lier', def: { fr: 'Épaissir une sauce (jaune d’œuf, farine, crème).', en: 'Thicken a sauce (egg yolk, flour, cream).' },
    match: { fr: ['lier', 'liez', 'lié', 'liée'], en: ['bind the sauce'] } },
  { id: 'epaissir', def: { fr: 'Rendre plus épais par cuisson ou par ajout.', en: 'Make thicker by cooking or adding.' },
    match: { fr: ['épaissir', 'épaissit', 'épaississez', 'épaissi'], en: ['thicken'] } },
  // « dorure » rattaché ici : dans le corpus, il désigne toujours une coloration
  // de cuisson (« jusqu’à (légère) dorure »), jamais le badigeon d’œuf. Le verbe
  // « dorer » garde sa propre entrée. La forme nom « coloration » est volontairement
  // absente (mot transparent) : sinon « coloration dorée » = double surlignage
  // (coloration + dorée) pour une seule notion.
  { id: 'colorer', def: { fr: 'Faire prendre une teinte dorée à la cuisson.', en: 'Let food take on a golden color while cooking.' },
    match: { fr: ['colorer', 'colorez', 'coloré', 'colorée', 'dorure'], en: ['brown lightly'] } },
  { id: 'delayer', def: { fr: 'Diluer un ingrédient dans un liquide.', en: 'Dilute an ingredient in a liquid.' },
    match: { fr: ['délayer', 'délayez', 'délayé', 'délayée'], en: ['dilute'] } },
  { id: 'tamiser', def: { fr: 'Passer une poudre au tamis pour l’aérer et retirer les grumeaux.', en: 'Sift a powder to aerate it and remove lumps.' },
    match: { fr: ['tamiser', 'tamisez', 'tamisé', 'tamisée'], en: ['sift'] } },
  { id: 'torrefier', def: { fr: 'Chauffer à sec pour développer les arômes (épices, fruits secs).', en: 'Dry-toast to develop the aromas (spices, nuts).' },
    match: { fr: ['torréfier', 'torréfiez', 'torréfié', 'torréfiée'], en: ['dry-toast'] } },
  { id: 'effiler', def: { fr: 'Couper en fines lamelles ; retirer le fil des haricots.', en: 'Cut into slivers; string the beans.' },
    match: { fr: ['effiler', 'effilez', 'effilé', 'effilée', 'effilées'], en: ['sliver'] } },
  { id: 'badigeonner', def: { fr: 'Étaler une fine couche au pinceau (jaune d’œuf, huile).', en: 'Brush on a thin layer.' },
    match: { fr: ['badigeonner', 'badigeonnez', 'badigeonné', 'badigeonnée'], en: ['brush with', 'brush on'] } },
  { id: 'tailler', def: { fr: 'Couper avec précision, en morceaux réguliers.', en: 'Cut precisely into even pieces.' },
    match: { fr: ['tailler', 'taillez', 'taillé', 'taillée'], en: ['cut into even pieces'] } },
  { id: 'trancher', def: { fr: 'Couper en tranches.', en: 'Cut into slices.' },
    match: { fr: ['trancher', 'tranchez', 'tranché', 'tranchée'], en: ['cut into slices'] } },
  { id: 'confire', def: { fr: 'Cuire lentement dans un gras ou un sirop pour conserver.', en: 'Cook slowly in fat or syrup to preserve.' },
    match: { fr: ['confire', 'confit', 'confite', 'confits'], en: ['confit'] } },
  { id: 'remuer', def: { fr: 'Mélanger en tournant pendant la cuisson.', en: 'Stir while cooking.' },
    match: { fr: ['remuer', 'remuez', 'remué', 'en remuant', 'remuant'], en: ['stirring', 'stir constantly'] } },
  { id: 'al-dente', def: { fr: 'Cuit juste ferme sous la dent (pâtes, riz).', en: 'Cooked just firm to the bite.' },
    match: { fr: ['al dente'], en: ['al dente'] } },
  { id: 'pincee', def: { fr: 'Petite quantité prise entre le pouce et l’index.', en: 'A small amount held between two fingers.' },
    match: { fr: ['pincée', 'pincées'], en: ['a pinch'] } },
  { id: 'ecumer', def: { fr: 'Retirer la mousse ou les impuretés à la surface d’un liquide.', en: 'Skim off the foam or impurities.' },
    match: { fr: ['écumer', 'écumez', 'écumé'], en: ['skim off', 'skim'] } },
  { id: 'flamber', def: { fr: 'Arroser d’alcool et enflammer brièvement.', en: 'Douse with alcohol and briefly set alight.' },
    match: { fr: ['flamber', 'flambez', 'flambé', 'flambée'], en: ['flambé'] } },
  { id: 'singer', def: { fr: 'Saupoudrer de farine pour lier une sauce.', en: 'Sprinkle with flour to thicken a sauce.' },
    match: { fr: ['singer', 'singez', 'singé'], en: ['dust with flour'] } },
  { id: 'mouiller', def: { fr: 'Ajouter du liquide dans une préparation en cuisson.', en: 'Add liquid to a cooking preparation.' },
    match: { fr: ['mouiller', 'mouillez', 'mouillé'], en: ['add liquid'] } },
  { id: 'rouler', def: { fr: 'Enrouler une préparation sur elle-même.', en: 'Roll a preparation up.' },
    match: { fr: ['rouler', 'roulez', 'roulé', 'roulée'], en: ['roll up'] } },
  { id: 'detendre', def: { fr: 'Assouplir une préparation trop ferme en ajoutant un liquide.', en: 'Loosen a too-firm mixture by adding liquid.' },
    match: { fr: ['détendre', 'détendez', 'détendu', 'détendue'], en: ['loosen the mixture'] } },
]

import { buildTermMatcher, splitTextWithMatcher } from './text-term-matcher'

const _cache = {}
function getMatcher(lang) {
  if (_cache[lang]) return _cache[lang]
  const entries = CULINARY_GLOSSARY.map(entry => ({
    formId: entry.id,
    kind: 'term',
    forms: entry.match[lang] ?? [],
    payload: entry.def,
  }))
  const matcher = buildTermMatcher(entries)
  _cache[lang] = matcher
  return matcher
}

/**
 * Découpe le texte d'une étape en segments, en marquant les termes du glossaire.
 * @param {string} text
 * @param {string} lang
 * @returns {Array<{type:'text',value:string} | {type:'term',value:string,id:string,def:{fr:string,en:string}}>}
 */
export function splitStepWithGlossary(text, lang) {
  if (!text) return [{ type: 'text', value: text ?? '' }]
  const matcher = getMatcher(lang)
  const segments = splitTextWithMatcher(text, matcher)
  return segments.map(s => (s.type === 'text' ? s : { type: 'term', value: s.value, id: s.id, def: s.payload }))
}
