// Les phrases qui défilent sous le logo (en-tête) et dans la fenêtre Premium.
// Une seule liste : elle existait en deux copies identiques, et l'audit du
// 2026-10-04 (UX-10) y a trouvé deux promesses fausses — « Planifie tes repas »
// (aucune planification dans l'app) et « La liste de courses qui se fait toute
// seule » (le panier est « Bientôt » sans le Premium). Une phrase ajoutée ici
// doit décrire ce que l'app fait déjà, pour tout le monde.
export const TAGLINES = {
  fr: [
    'Cuisine mieux, sans limites.',
    'Ton assistant cuisine personnel.',
    "Plus d’idées, moins de stress en cuisine.",
    'Transforme tes restes en plats savoureux.',
    'Des recettes sur mesure, chaque soir.',
    'Moins de gaspillage, plus de créativité.',
    'La cuisine du quotidien, enfin inspirante.',
    "Ouvre ton frigo. Trouve l’inspiration.",
  ],
  en: [
    'Cook better, without limits.',
    'Your personal kitchen assistant.',
    'More ideas, less kitchen stress.',
    'Turn your leftovers into delicious dishes.',
    'Tailored recipes, every evening.',
    'Less waste, more creativity.',
    'Everyday cooking, finally inspiring.',
    'Open your fridge. Find your inspiration.',
  ],
}
