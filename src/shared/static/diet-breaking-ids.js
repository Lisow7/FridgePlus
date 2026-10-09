// IDs d'ingrédients incompatibles par régime (halal géré manuellement).
// Inclut les IDs parents de groupes (ex: 'fr-lait', 'fr-fromage') ET les enfants
// pour que la détection se déclenche que l'utilisateur sélectionne le générique
// ou une variante.
//
// Utilisé par RecipeFormModal pour décocher automatiquement les badges
// Végétarien / Vegan / Sans gluten / Sans lactose dès qu'un ingrédient
// incompatible est ajouté à la recette.
//
// DÉCISION PRODUIT (2026-06-28) — PRÉSURE des fromages durs AOP :
//   Les fromages à présure ANIMALE obligatoire (parmesan, grana-padano,
//   pecorino, gorgonzola, kéfalotyri) sont techniquement non-végétariens, mais
//   sont VOLONTAIREMENT ABSENTS du set `vegetarian` ci-dessous.
//   Raison : végétarien = préférence/éthique (≠ sécurité allergène) ; convention
//   grand public écrasante (les lacto-végétariens consomment le parmesan, tous
//   les sites le marquent végétarien) ; des versions à présure microbienne
//   existent. Les casser retirerait ~30 recettes (carbonara, risottos, gratins…)
//   du filtre végétarien au nom d'une minorité stricte = net-négatif.
//   ⇒ NE PAS ajouter ces fromages au set `vegetarian`. (≠ logique allergènes : là
//   on sur-déclare par sécurité ; ici on suit la convention par utilité.)

export const DIET_BREAKING_IDS = {
  vegetarian: new Set([
    'fr-boeuf','fr-bavette','fr-entrecote','fr-filet-boeuf','fr-hache-boeuf','fr-paleron',
    'fr-poulet','fr-blanc-poulet','fr-cuisse-poulet','fr-poulet-entier',
    'fr-porc','fr-cote-porc','fr-travers-porc','fr-echine','fr-filet-porc','fr-porc-hache','fr-chair-saucisse',
    'fr-veau','fr-escalope-veau','fr-jarret-veau',
    'fr-canard','fr-cuisse-canard','fr-magret',
    'fr-agneau','fr-cote-agneau','fr-gigot','fr-epaule-agneau',
    'fr-lapin','fr-dinde',
    'fr-foie','fr-foie-veau','fr-foie-volaille',
    'fr-andouillette',
    'frz-poulet','frz-cuisses','frz-escalope','frz-nuggets','frz-cordon-bleu',
    'frz-boeuf','frz-boeuf-hache','frz-steaks-haches','frz-steak-boeuf','frz-roti-boeuf',
    'frz-saucisse','frz-saucisses','frz-merguez','frz-boulettes',
    'frz-blanquette','frz-porc',
    'frz-chili','frz-croque','frz-hachis','frz-lasagnes','frz-poulet-roti','frz-sole','frz-tartiflette',
    'fr-poissons','fr-bar','fr-cabillaud','fr-daurade','fr-lieu-jaune','fr-maquereau','fr-saumon','fr-sole','fr-thon','fr-truite',
    'fr-fruits-mer','fr-crevettes','fr-homard','fr-huitres','fr-moules','fr-calmar','fr-poulpe','fr-seiche',
    'fr-poissons-fumes','fr-saumon-fume','fr-truite-fumee','fr-hareng-fume',
    'frz-poissons','frz-cabillaud','frz-colin','frz-daurade','frz-pangasius','frz-saumon-pave','frz-thon-steak',
    'frz-fruits-mer','frz-crevettes','frz-coquilles','frz-moules','frz-calamars','frz-surimi',
    'frz-poissons-panes',
    'gp-poissons-cons','gp-thon','gp-sardines','gp-maquereau','gp-anchois',
    'fr-jambon','fr-jambon-blanc','fr-jambon-sec',
    'fr-bacon','fr-lardons','fr-mortadelle',
    'fr-saucisse-seche','fr-chorizo','fr-saucisson','fr-rosette','fr-andouille','fr-morcilla','fr-saucisse-fumee',
    'fr-pate-terrine','fr-pate-campagne','fr-rillettes','fr-terrine','fr-mousse-canard',
    'jp-katsuobushi','jp-niboshi','jp-sakura-ebi',
    'jp-dashi-pack','jp-mentsuyu','jp-shiro-dashi',
    'sp-nuoc-mam','sp-sauce-huitre',
    'sp-sauce-tonkatsu',
    'gp-gelatine',
  ]),
  vegan: new Set([
    'fr-boeuf','fr-bavette','fr-entrecote','fr-filet-boeuf','fr-hache-boeuf','fr-paleron',
    'fr-poulet','fr-blanc-poulet','fr-cuisse-poulet','fr-poulet-entier',
    'fr-porc','fr-cote-porc','fr-travers-porc','fr-echine','fr-filet-porc','fr-porc-hache','fr-chair-saucisse',
    'fr-veau','fr-escalope-veau','fr-jarret-veau',
    'fr-canard','fr-cuisse-canard','fr-magret',
    'fr-agneau','fr-cote-agneau','fr-gigot','fr-epaule-agneau',
    'fr-lapin','fr-dinde',
    'fr-foie','fr-foie-veau','fr-foie-volaille',
    'fr-andouillette',
    'frz-poulet','frz-cuisses','frz-escalope','frz-nuggets','frz-cordon-bleu',
    'frz-boeuf','frz-boeuf-hache','frz-steaks-haches','frz-steak-boeuf','frz-roti-boeuf',
    'frz-saucisse','frz-saucisses','frz-merguez','frz-boulettes',
    'frz-blanquette','frz-porc',
    'frz-chili','frz-croque','frz-hachis','frz-lasagnes','frz-poulet-roti','frz-sole','frz-tartiflette','frz-quiche','frz-gratin',
    'fr-poissons','fr-bar','fr-cabillaud','fr-daurade','fr-lieu-jaune','fr-maquereau','fr-saumon','fr-sole','fr-thon','fr-truite',
    'fr-fruits-mer','fr-crevettes','fr-homard','fr-huitres','fr-moules','fr-calmar','fr-poulpe','fr-seiche',
    'fr-poissons-fumes','fr-saumon-fume','fr-truite-fumee','fr-hareng-fume',
    'frz-poissons','frz-cabillaud','frz-colin','frz-daurade','frz-pangasius','frz-saumon-pave','frz-thon-steak',
    'frz-fruits-mer','frz-crevettes','frz-coquilles','frz-moules','frz-calamars','frz-surimi',
    'frz-poissons-panes',
    'gp-poissons-cons','gp-thon','gp-sardines','gp-maquereau','gp-anchois',
    'fr-jambon','fr-jambon-blanc','fr-jambon-sec',
    'fr-bacon','fr-lardons','fr-mortadelle',
    'fr-saucisse-seche','fr-chorizo','fr-saucisson','fr-rosette','fr-andouille','fr-morcilla','fr-saucisse-fumee',
    'fr-pate-terrine','fr-pate-campagne','fr-rillettes','fr-terrine','fr-mousse-canard',
    'jp-katsuobushi','jp-niboshi','jp-sakura-ebi',
    'jp-dashi-pack','jp-mentsuyu','jp-shiro-dashi',
    'sp-nuoc-mam','sp-sauce-huitre',
    'sp-sauce-tonkatsu',
    'fr-beurre','fr-ghee',
    'fr-creme','fr-creme-epaisse','fr-creme-fraiche','fr-creme-liquide',
    'fr-lait','fr-lait-demi','fr-lait-entier',
    'fr-yaourt','fr-yaourt-nature','fr-kefir','fr-fromage-blanc','fr-petits-suisses','fr-skyr','fr-labneh',
    'fr-fromage','fr-mascarpone','fr-ricotta','fr-fromage-rape','fr-fromage-frais',
    'fr-brie','fr-camembert','fr-cheddar','fr-chevre','fr-comte','fr-emmental','fr-fourme','fr-grana-padano','fr-gruyere','fr-mimolette','fr-mozzarella','fr-parmesan','fr-raclette','fr-reblochon','fr-roquefort','fr-saint-nectaire','fr-feta','fr-burrata','fr-gorgonzola','fr-pecorino','fr-kefalotyri',
    'fr-oeuf','fr-oeufs-bio','fr-oeufs-caille','fr-oeufs-canard','fr-oeufs-fermier','fr-oeufs-label-r','fr-oeufs-plein-air','fr-oeufs-poules','fr-oeufs-standard',
    'frz-glace-baton','frz-barre-glacee','frz-magnum','frz-cornet','frz-bac-vanille','frz-choco-glace','frz-pistache','frz-cafe-glace','frz-glace-fraise','frz-buche-glacee','frz-profiteroles',
    'gp-miel','gp-choco-lait','gp-choco-blanc','gp-pate-tartiner-choco','gp-boudoirs','gp-pralines','gp-caramel',
    'sp-bechamel','sp-pesto','sp-mayonnaise','sp-aioli',
    'gp-lait-concentre-sucre',
    'gp-gelatine',
  ]),
  'gluten-free': new Set([
    'gp-pain','gp-baguette','gp-pain-mie','gp-pain-complet','gp-pain-seigle','gp-pain-burger','gp-pain-grille',
    'gp-biscottes','gp-biscuits-sale','gp-chapelure','gp-crackers','gp-croûtons','gp-grissini','gp-panko',
    'gp-viennois-frais','gp-croissant-frais','gp-pain-choc-frais','gp-brioche-fraiche','gp-chausson-frais',
    'frz-viennoiseries','frz-croissant','frz-chocolatine','frz-chausson','frz-brioche',
    'frz-pains-cong','frz-baguette','frz-pain-campagne','frz-pain-cereales','frz-pain-hamburger','frz-pain-mie','frz-pain-epi','frz-paton-pizza',
    'frz-lasagnes','frz-pizza','frz-quiche','frz-croque',
    'gp-pates','gp-coquillettes','gp-farfalle','gp-fusilli','gp-lasagnes-sec','gp-nouilles-asie','gp-orzo','gp-penne','gp-spaghetti','gp-tagliatelles','gp-vermicelles','gp-couscous','gp-boulgour',
    'gp-avoine','gp-ble-ebly','gp-semoule','gp-farine-ble','gp-farine-epeautre','gp-flocons-avoine','gp-granola','gp-muesli',
    'jp-fu','jp-udon','jp-ramen-sec','jp-somen','jp-yakisoba-men','jp-hiyamugi','jp-mentsuyu','jp-okonomisauce',
    'gp-boudoirs','sp-bechamel','sp-sauce-soja','sp-worcestershire',
    'sp-gochujang','sp-doubanjiang','sp-sauce-tonkatsu',
    'gp-tortillas-ble','gp-pate-filo','gp-feuille-brick','gp-gnocchi','gp-cannelloni','gp-pain-pita',
    // Traces « contient » (Lot 3 chantier traces) : produits dont le blé/orge est ingrédient.
    'gp-bouillon-cube','gp-cereales-matin','jp-miso-aka','jp-ponzu','jp-shiro-dashi',
  ]),
  'dairy-free': new Set([
    'fr-beurre','fr-ghee',
    'fr-creme','fr-creme-epaisse','fr-creme-fraiche','fr-creme-liquide',
    'fr-lait','fr-lait-demi','fr-lait-entier',
    'fr-yaourt','fr-yaourt-nature','fr-kefir','fr-fromage-blanc','fr-petits-suisses','fr-skyr','fr-labneh',
    'fr-fromage','fr-mascarpone','fr-ricotta','fr-fromage-rape','fr-fromage-frais',
    'fr-brie','fr-camembert','fr-cheddar','fr-chevre','fr-comte','fr-emmental','fr-fourme','fr-grana-padano','fr-gruyere','fr-mimolette','fr-mozzarella','fr-parmesan','fr-raclette','fr-reblochon','fr-roquefort','fr-saint-nectaire','fr-feta','fr-burrata','fr-gorgonzola','fr-pecorino','fr-kefalotyri',
    'frz-tartiflette','frz-gratin','frz-lasagnes','frz-quiche','frz-croque','frz-pizza',
    'frz-glace-baton','frz-barre-glacee','frz-magnum','frz-cornet','frz-bac-vanille','frz-choco-glace','frz-pistache','frz-cafe-glace','frz-glace-fraise','frz-buche-glacee','frz-profiteroles',
    'gp-choco-lait','gp-choco-blanc','gp-pate-tartiner-choco','gp-pralines','gp-caramel',
    'sp-bechamel','sp-pesto',
    'gp-lait-concentre-sucre',
  ]),
}
