// Le vocabulaire Schema.org d'une recette, écrit UNE fois pour ses deux
// producteurs : le pré-rendu (`scripts/lib/prerender-page.mjs`, le HTML servi
// aux robots) et l'application (`recipe-to-schema-org.js`, posé au montage).
//
// Module sans import : lu tel quel par Node au build, et par l'app.
//
// Les deux producteurs avaient chacun leur table, comparées par un test — et
// elles s'étaient trompées ENSEMBLE : `drink` (12 recettes) et `sauce-base`
// (14) n'avaient de catégorie ni dans l'une ni dans l'autre (audit du
// 2026-10-04, SEO-13). Comparer deux copies ne dit pas qu'elles sont justes ;
// le garde-fou `balisage-recette` exige une catégorie pour chaque type que
// l'admin peut choisir (`TYPE_OPTIONS`).

const CATEGORIES = {
  // Codes de la base (`recipes_unified.type`, `TYPE_OPTIONS` de l'admin)
  main: 'Main Course',
  starter: 'Appetizer',
  side: 'Side Dish',
  dessert: 'Dessert',
  salad: 'Salad',
  drink: 'Beverage',
  'sauce-base': 'Sauce',
  // Anciens codes (fichiers JS statiques)
  entree: 'Appetizer',
  plat: 'Main Course',
  apero: 'Snack',
  brunch: 'Brunch',
  petitdej: 'Breakfast',
  sauce: 'Sauce',
  boisson: 'Beverage',
  soupe: 'Soup',
  accompagnement: 'Side Dish',
  // Libellés FR (valeurs héritées)
  'Plat principal': 'Main Course',
  'Entrée & Soupe': 'Appetizer',
  'Accompagnement': 'Side Dish',
}

/**
 * Type de plat Fridge+ → `recipeCategory` Schema.org, ou `undefined`.
 *
 * Une clé PROPRE et non `CATEGORIES[type]` : un type « constructor » rendait
 * la fonction `Object` comme catégorie. `hasOwnProperty.call` plutôt
 * qu'`Object.hasOwn`, absent avant Safari 15.4.
 */
export function categorieSchemaOrg(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(CATEGORIES, type)
    ? CATEGORIES[type]
    : undefined
}

// « International » n'est pas une cuisine : Schema.org attend une cuisine ou
// une région (« French », « Mediterranean »). 71 recettes l'annonçaient.
// Le CODE (`intl`, table `taxonomies`) sert l'application et le générateur du
// manifeste ; le NOM sert le pré-rendu, qui ne lit que le nom déjà résolu dans
// `scripts/data/prerender-manifest.json`.
const PAYS_SANS_CUISINE = new Set(['intl'])
const NOMS_SANS_CUISINE = new Set(['International'])

/**
 * Le nom à annoncer en `recipeCuisine`, ou `undefined`.
 * `code` peut manquer (le manifeste ne garde que le nom).
 */
export function cuisineSchemaOrg({ code, nom } = {}) {
  if (!nom || typeof nom !== 'string') return undefined
  if (code && PAYS_SANS_CUISINE.has(code)) return undefined
  if (NOMS_SANS_CUISINE.has(nom)) return undefined
  return nom
}
