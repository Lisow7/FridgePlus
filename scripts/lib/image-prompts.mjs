// Module de prompts d'images IA — fonctions pures testables.
// Extrait de generate-food-images.mjs pour éviter les imports lourds (OpenAI, sharp) dans les tests.

import { CORRECTIONS_AUDIT_2026_08_26 } from './image-prompt-corrections-2026-08-26.mjs'
import { CORRECTIONS_RECETTES_2026_08_26 } from './recipe-prompt-corrections-2026-08-26.mjs'

const PROMPT_INGREDIENT = (label) =>
  `Flat 3D-soft icon of ${label}, centered on transparent white background, ` +
  `warm natural lighting, simple silhouette, vibrant natural colors, no shadow, ` +
  `recognizable at 24px, food illustration style, modern minimal, consistent style.`

const PROMPT_RECIPE = (name) =>
  `Realistic food photography of ${name}, top-down view OR 3/4 perspective, ` +
  `styled plate on neutral background, soft warm lighting, appetizing, ` +
  `magazine-quality, modern food blogging aesthetic.`

const PROMPT_FRIDGE = (label) =>
  `Flat 3D-soft icon of ${label} kitchen storage compartment, centered on transparent background, ` +
  `simple silhouette, vibrant natural colors, no shadow, recognizable at 24px, ` +
  `modern minimal style.`

// Overrides spécifiques pour items qui prêtent à confusion (mapping ID → prompt custom).
// IMPORTANT : préfixes BDD (sp-=spice, gp-=grocery/pantry, jp-=japanese, fr-=fridge, vg-=veggie).
export const INGREDIENT_OVERRIDES = {
  'sp-basilic':         'Flat 3D-soft icon of fresh bright green basil leaves, flat oval shape, glossy, centered on transparent background, no shadow, modern minimal style, recognizable at 24px',
  'sp-persil':          'Flat 3D-soft icon of curly dark green parsley sprigs, distinctive curls, centered on transparent background, no shadow, modern minimal style',
  'sp-coriandre':       'Flat 3D-soft icon of fresh cilantro coriander leaves, light green flat leaves, centered on transparent background, no shadow, modern minimal style',
  'sp-thym':            'Flat 3D-soft icon of fresh thyme sprig, tiny dark green leaves on stem, centered on transparent background, no shadow, modern minimal style',
  // Cas confus CRITIQUE : curcuma (poudre jaune-or PURE) vs gingembre (rhizome BEIGE pâle).
  'sp-curcuma':         'Flat 3D-soft icon of bright YELLOW-GOLD turmeric powder small mound ONLY, no rhizome visible, pure spice powder pile, centered on transparent background, no shadow, modern minimal style',
  'sp-gingembre':       'Flat 3D-soft icon of single knobby pale BEIGE-TAN ginger root with light brown papery skin, irregular knobs, NO powder, NO orange tint, centered on transparent background, no shadow, modern minimal style',
  'fr-camembert':       'Flat 3D-soft icon of round Camembert cheese wheel with white soft rind, centered on transparent background, no shadow, modern minimal style',
  'fr-mozzarella':      'Flat 3D-soft icon of pure white mozzarella ball, smooth surface, centered on transparent background, no shadow, modern minimal style',
  'fr-feta':            'Flat 3D-soft icon of crumbly white feta cheese cube, slightly grainy, centered on transparent background, no shadow, modern minimal style',
  'fr-parmesan':        'Flat 3D-soft icon of aged Parmesan cheese wedge, golden-yellow rind, dry crumbly texture, centered on transparent background, no shadow, modern minimal style',
  'gp-lentilles-vertes':'Flat 3D-soft icon of small green-brown lentils pile, centered on transparent background, no shadow, modern minimal style',
  'gp-lentilles-coral': 'Flat 3D-soft icon of vivid orange split coral lentils pile, centered on transparent background, no shadow, modern minimal style',
  'sp-tahini':          'Flat 3D-soft icon of beige sesame tahini paste in small jar, centered on transparent background, no shadow, modern minimal style',
  'jp-miso':            'Flat 3D-soft icon of red-brown miso paste in small ceramic bowl, centered on transparent background, no shadow, modern minimal style',
  'jp-miso-aka':        'Flat 3D-soft icon of dark red-brown aka miso paste in small bowl, centered on transparent background, no shadow, modern minimal style',
  'jp-miso-shiro':      'Flat 3D-soft icon of pale yellow shiro white miso paste in small bowl, centered on transparent background, no shadow, modern minimal style',
  'jp-dashi':           'Flat 3D-soft icon of clear golden dashi broth in Japanese bowl, centered on transparent background, no shadow, modern minimal style',
  'sp-baharat':         'Flat 3D-soft icon of warm brown baharat spice powder mound, centered on transparent background, no shadow, modern minimal style',
  'sp-ras-el-hanout':   'Flat 3D-soft icon of reddish-orange ras-el-hanout spice powder mound, centered on transparent background, no shadow, modern minimal style',

  // ── Lot du 2026-08-26 : les 41 icônes manquantes ──────────────────────────
  // Méthode (demandée par le mainteneur après un pita rendu comme un cookie) :
  // pour chaque item ambigu, décrire les TRAITS IDENTITAIRES relevés sur des
  // références réelles (recherche web pour kéfalotyri, doubanjiang, dangmyeon)
  // — c'est le trait distinctif qui fait la correspondance, pas le nom seul.
  'gp-pain-pita':       'Flat 3D-soft icon of round Middle-Eastern pita POCKET bread, one pita cut in half showing the open hollow pocket inside, pale golden flat bread, NO chocolate chips, NO cookie, centered on transparent background, no shadow, modern minimal style',
  'gp-gnocchi':         'Flat 3D-soft icon of small Italian potato gnocchi dumplings, each with distinctive FORK RIDGE lines on top, pale yellow oval dumplings in a small pile, centered on transparent background, no shadow, modern minimal style',
  'fr-beurre-doux':     'Flat 3D-soft icon of plain smooth golden-pale butter block with one cut pat, clean smooth surface, centered on transparent background, no shadow, modern minimal style',
  'fr-beurre-demi-sel': 'Flat 3D-soft icon of golden-pale butter block sprinkled with visible white sea salt crystals on top, centered on transparent background, no shadow, modern minimal style',
  // Corrigé 2 fois après audits du 2026-08-26 (chantilly, puis « cervelle ») —
  // généré en gpt-image-2, mini n'adhérait pas au prompt.
  'fr-chair-saucisse':  'Flat 3D-soft icon of raw sausage meat (ground pork mince), a loose crumbly mound of many small irregular strands and granules of pale pink raw minced meat with tiny white fat specks, matte surface, NOT glossy, NOT smooth piped frosting, NOT icing swirls, no brain-like folds, centered on transparent background, no shadow, modern minimal style',
  'fr-kefalotyri':      'Flat 3D-soft icon of hard Greek kefalotyri cheese wedge, pale straw-yellow dense paste with very few tiny eyes, amber-straw hard rind, centered on transparent background, no shadow, modern minimal style',
  'fr-morcilla':        'Flat 3D-soft icon of Spanish morcilla blood sausage, very dark brown-black link with two slices showing dark interior with rice grains, centered on transparent background, no shadow, modern minimal style',
  'fr-pecorino':        'Flat 3D-soft icon of pecorino romano cheese wedge, pale ivory-white dense paste, thin dark charcoal rind, NOT golden like parmesan, centered on transparent background, no shadow, modern minimal style',
  'fr-porc-hache':      'Flat 3D-soft icon of raw ground pork mound, pale pink minced meat strands, centered on transparent background, no shadow, modern minimal style',
  'fr-saucisse-fumee':  'Flat 3D-soft icon of curved smoked sausage link, deep reddish-brown glossy casing, centered on transparent background, no shadow, modern minimal style',
  // Corrigé après audit du 2026-08-26 (rendu : gros haricots kidney).
  'gp-azuki':           'Flat 3D-soft icon of a small pile of azuki beans, tiny plump cylindrical dark crimson-red beans about rice-grain scale, each with a distinctive thin WHITE RIDGE line (hilum) along one side, NOT kidney-shaped, NOT large kidney beans, no oval white spot, many small beans to convey their tiny size, centered on transparent background, no shadow, modern minimal style',
  'gp-cannelloni':      'Flat 3D-soft icon of dry cannelloni pasta, three large wide hollow pale-yellow tubes, NOT filled, centered on transparent background, no shadow, modern minimal style',
  'gp-coco-rapee':      'Flat 3D-soft icon of shredded white desiccated coconut pile with half coconut shell behind, centered on transparent background, no shadow, modern minimal style',
  'gp-cognac':          'Flat 3D-soft icon of cognac brandy snifter glass with amber liquid, short round-bellied glass, centered on transparent background, no shadow, modern minimal style',
  'gp-farine-mais':     'Flat 3D-soft icon of fine YELLOW cornmeal flour powder mound, dry powder, NOT white wheat flour, centered on transparent background, no shadow, modern minimal style',
  'gp-feuille-brick':   'Flat 3D-soft icon of round paper-thin translucent brik pastry sheets, one sheet slightly lifted at the corner, off-white, centered on transparent background, no shadow, modern minimal style',
  'gp-houmous':         'Flat 3D-soft icon of beige hummus in small bowl with olive oil swirl, a few whole chickpeas and paprika dusting on top, centered on transparent background, no shadow, modern minimal style',
  'gp-lait-concentre-sucre': 'Flat 3D-soft icon of open tin can with thick glossy cream-white sweetened condensed milk, spoon drizzling a thick ribbon, centered on transparent background, no shadow, modern minimal style',
  'gp-pate-filo':       'Flat 3D-soft icon of stacked paper-thin translucent filo pastry sheets, edges slightly ruffled, off-white, centered on transparent background, no shadow, modern minimal style',
  'gp-polenta':         'Flat 3D-soft icon of creamy cooked YELLOW polenta porridge in a bowl, thick golden texture, NOT dry powder, centered on transparent background, no shadow, modern minimal style',
  'gp-tapioca':         'Flat 3D-soft icon of small round white tapioca pearls pile, uniform tiny spheres, centered on transparent background, no shadow, modern minimal style',
  'gp-the-noir':        'Flat 3D-soft icon of loose dark black tea leaves small mound, dry curled leaves, centered on transparent background, no shadow, modern minimal style',
  'gp-tortillas-ble':   'Flat 3D-soft icon of stack of soft round wheat flour tortillas, pale flexible flatbreads with light brown spots, NOT crispy chips, centered on transparent background, no shadow, modern minimal style',
  // Corrigé 2 fois après audits du 2026-08-26 (corde, encore corde) —
  // généré en gpt-image-2, mini n'adhérait pas au prompt.
  'jp-dangmyeon':       'Flat 3D-soft icon of dangmyeon Korean glass noodles, a folded bundle of VERY thin hair-like semi-translucent greyish-brown sweet potato starch noodles, wiry and slightly glassy strands much thinner than spaghetti, bundle bent in half and tied with a simple band, NOT rope, NOT cord, NOT thick strands, NOT opaque white, centered on transparent background, no shadow, modern minimal style',
  // Corrigé 2 fois après audits du 2026-08-26 (olives, puis cardamome) —
  // généré en gpt-image-2, mini n'adhérait pas au prompt.
  'sp-capres':          'Flat 3D-soft icon of a small glass jar of capers in brine, filled with MANY TINY round dark olive-green flower buds the size of peas, each a compact bud with tightly closed overlapping sepals, buds very small relative to the jar, NOT ribbed spindle-shaped pods, NOT cardamom pods, NOT olives, no stems, centered on transparent background, no shadow, modern minimal style',
  'sp-citronnelle':     'Flat 3D-soft icon of fresh lemongrass stalks, two pale green-white stalks with bulbous base and cut tops, centered on transparent background, no shadow, modern minimal style',
  'sp-doubanjiang':     'Flat 3D-soft icon of doubanjiang chili bean paste in small jar, deep reddish-brown CHUNKY paste with visible broad bean and chili flecks and light oil sheen, centered on transparent background, no shadow, modern minimal style',
  // ⚠️ Paire confuse avec `sp-gingembre` (déjà en override plus haut) :
  // le galanga est PLUS PÂLE, peau lisse marquée d'anneaux sombres.
  'sp-galanga':         'Flat 3D-soft icon of galangal rhizome, pale cream-white smooth skin with distinctive thin dark rings, pinkish young shoots, paler and smoother than ginger, centered on transparent background, no shadow, modern minimal style',
  // Corrigé après audit du 2026-08-26 (teinte paprika orange).
  'sp-garam-masala':    'Flat 3D-soft icon of a small mound of garam masala spice powder, warm medium BROWN color with cinnamon-cocoa undertone, NOT orange, NOT red paprika color, fine powder texture, centered on transparent background, no shadow, modern minimal style',
  'sp-poivre-vert':     'Flat 3D-soft icon of fresh green peppercorns, small green berries in clusters on a stem, centered on transparent background, no shadow, modern minimal style',
  'sp-sauce-tonkatsu':  'Flat 3D-soft icon of Japanese tonkatsu sauce bottle, dark brown thick sauce, squeeze bottle, centered on transparent background, no shadow, modern minimal style',
  'vg-cresson':         'Flat 3D-soft icon of fresh watercress bunch, many small round dark-green leaves on thin stems, centered on transparent background, no shadow, modern minimal style',
  'vg-tomatillo':       'Flat 3D-soft icon of green tomatillo fruit with its papery husk half-open showing the glossy green fruit, centered on transparent background, no shadow, modern minimal style',

  // ── AUDIT COMPLET des 612 anciennes (2026-08-26) : 115 corrections ────────
  // En DERNIER pour primer sur les entrées historiques re-jugées par l'audit
  // (sp-thym, fr-mozzarella, jp-miso). Détail et provenance dans le module.
  ...CORRECTIONS_AUDIT_2026_08_26,
}

// Overrides RECETTES — même mécanisme que les ingrédients, ajouté le
// 2026-08-26 pour corriger les correspondances ratées repérées à l'audit
// visuel post-batch (une photo qui ne ressemble pas au plat se régénère par
// `--ids=<id> --force` après ajout d'une entrée ici).
export const RECIPE_OVERRIDES = {
  // Audit complet des 406 photos du 2026-08-26 — voir le module.
  ...CORRECTIONS_RECETTES_2026_08_26,
}

export function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [key, ...rest] = arg.slice(2).split('=')
    args[key] = rest.length ? rest.join('=') : true
  }
  return args
}

export function buildPrompt(type, item) {
  if (type === 'ingredients') {
    if (INGREDIENT_OVERRIDES[item.id]) return INGREDIENT_OVERRIDES[item.id]
    const label = item.labels?.en ?? item.labels?.fr ?? item.id
    return PROMPT_INGREDIENT(label)
  }
  if (type === 'recipes') {
    if (RECIPE_OVERRIDES[item.id]) return RECIPE_OVERRIDES[item.id]
    const name = item.name?.en ?? item.name?.fr ?? item.id
    return PROMPT_RECIPE(name)
  }
  if (type === 'fridge') {
    return PROMPT_FRIDGE(item.label_en ?? item.label ?? item.id)
  }
  throw new Error(`Unknown type: ${type}`)
}
