// Taxonomie des ingrédients — périmètre ADMIN uniquement.
// ⚠️ `FOOD_EMOJIS` existe aussi dans `leftovers-modal` et `recipe-form-modal`
// avec des listes DIFFÉRENTES : cette copie a été DÉPLACÉE ici, pas mutualisée.

export const FOOD_EMOJIS = [
  '🍎','🍊','🍋','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥝','🍅','🍆','🥑',
  '🫑','🥦','🥬','🥒','🌽','🥕','🧅','🥔','🍠','🫘','🥜','🌰','🫚','🧄',
  '🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥚','🧈','🥞','🧇',
  '🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🥙','🥗','🫕','🥘','🍲',
  '🦐','🦞','🦀','🦑','🐟','🍣','🍱','🍜','🍝','🍛','🍚',
  '🍦','🍧','🍨','🍰','🎂','🧁','🍮','🍯','🍫','🍬','🍭',
  '🧃','🥤','🧋','🍵','☕','🫖','🥛','🍶','🫙','🧂','🫒','🌿','🌱','🍄','🌾',
]

export const SUBCATEGORY_TO_STORAGE = {
  'frozen-meat':'frz','frozen-fish':'frz','frozen-veg':'frz','ready-meals':'frz','ice-cream':'frz','frozen-bread':'frz',
  'meat':'fr','fish':'fr','dairy':'fr','cheese':'fr','eggs':'fr','deli':'fr','today':'fr','thisweek':'fr',
  'vegetables':'vg','fruits':'vg',
  'pasta-rice':'gp','canned':'gp','cereals':'gp','bread':'gp','sweet':'gp',
  'salt-spices':'sp','herbs':'sp','sauces':'sp','oils':'sp',
  'tofu':'fr','rice':'gp','dry':'gp','basic':'sp',
}
export const SUBCATEGORIES = Object.keys(SUBCATEGORY_TO_STORAGE)

export const PREFIX_OPTIONS = [
  { value:'fr-',  label:'🧊 Frigo',        subcats:['meat','fish','dairy','cheese','eggs','deli','today','thisweek','tofu'] },
  { value:'frz-', label:'❄️ Congélateur',  subcats:['frozen-meat','frozen-fish','frozen-veg','ready-meals','ice-cream','frozen-bread'] },
  { value:'vg-',  label:'🥦 Légumes',      subcats:['vegetables','fruits'] },
  { value:'gp-',  label:'🥫 Épicerie',     subcats:['pasta-rice','canned','cereals','bread','sweet','rice','dry'] },
  { value:'sp-',  label:'🧂 Épices',       subcats:['salt-spices','herbs','sauces','oils','basic'] },
]

export const SUBCAT_LABELS = {
  'meat':'🥩 Viande','fish':'🐟 Poisson','dairy':'🥛 Laitages','cheese':'🧀 Fromages','eggs':'🥚 Œufs',
  'deli':'🥓 Charcuterie','today':'📅 À consommer aujourd\'hui','thisweek':'📅 À consommer cette semaine',
  'tofu':'🫘 Tofu / végétal','frozen-meat':'🥩 Viande surgelée','frozen-fish':'🐟 Poisson surgelé',
  'frozen-veg':'🥦 Légumes surgelés','ready-meals':'🍱 Plats préparés','ice-cream':'🍦 Glaces',
  'frozen-bread':'🍞 Pain surgelé','vegetables':'🥕 Légumes frais','fruits':'🍎 Fruits frais',
  'pasta-rice':'🍝 Pâtes / Riz','canned':'🥫 Conserves','cereals':'🥣 Céréales','bread':'🍞 Pain / Viennoiseries',
  'sweet':'🍫 Sucreries','rice':'🍚 Riz blanc','dry':'🫘 Légumineuses',
  'salt-spices':'🧂 Sel / Épices','herbs':'🌿 Herbes aromatiques','sauces':'🫙 Sauces / Condiments',
  'oils':'🫒 Huiles / Vinaigres','basic':'🧴 Produits de base',
}

// Vit dans son propre module (l'API admin, chargée au démarrage, s'en sert).
export { slugify } from './slug'

export const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
