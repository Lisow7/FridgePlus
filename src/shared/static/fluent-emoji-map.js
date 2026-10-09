// Mapping char Unicode → nom Iconify Fluent Emoji (Microsoft, MIT licence).
//
// Fluent Emoji 3D est le style le plus proche de nos images IA générées
// (gpt-image-1 "flat 3D-soft icon"), garantissant la cohérence visuelle
// pour les ingrédients qui n'ont pas encore d'image custom en BDD.
//
// Images HÉBERGÉES PAR LE SITE : public/emoji/fluent/{name}.svg (décision du 2026-10-06
// du 2026-10-06, « emoji = sur_le_site » — elles étaient demandées à Iconify,
// qui recevait l'adresse IP de chaque visiteur avant tout choix de cookies).
// Style « Color » de Fluent Emoji.
//
// Note : ce mapping ne couvre pas TOUS les emojis du repertoire Unicode.
// Pour les emojis non listés ici, le composant <Emoji> tombe sur Twemoji
// (fallback existant). Ajouter au mapping uniquement les emojis fréquents —
// et son fichier dans public/emoji/fluent/ (le test emoji-sur-le-site le
// vérifie).

export const FLUENT_EMOJI_MAP = {
  // ── Fruits ──────────────────────────────────────────────────────────
  '🍅': 'tomato',
  '🍌': 'banana',
  '🍋': 'lemon',
  '🥑': 'avocado',
  '🍆': 'eggplant',
  '🌽': 'ear-of-corn',
  '🥒': 'cucumber',
  '🍇': 'grapes',
  '🍓': 'strawberry',
  '🍒': 'cherries',
  '🍎': 'red-apple',
  '🍏': 'green-apple',
  '🍐': 'pear',
  '🍉': 'watermelon',
  '🥝': 'kiwi-fruit',
  '🥭': 'mango',
  '🍑': 'peach',
  '🍊': 'tangerine',
  '🍍': 'pineapple',
  '🥥': 'coconut',
  '🍈': 'melon',
  '🫐': 'blueberries',

  // ── Légumes ─────────────────────────────────────────────────────────
  '🥕': 'carrot',
  '🥬': 'leafy-green',
  '🥦': 'broccoli',
  '🧅': 'onion',
  '🧄': 'garlic',
  '🍄': 'mushroom',
  '🫑': 'bell-pepper',
  '🌶️': 'hot-pepper',
  '🫒': 'olive',
  '🥜': 'peanuts',
  '🌰': 'chestnut',
  '🫘': 'beans',
  '🍠': 'roasted-sweet-potato',
  // Unicode 15 : absents de Twemoji 14, présents chez Fluent (2026-10-06).
  '🫚': 'ginger-root',
  '🫛': 'pea-pod',

  // ── Protéines (viandes, poissons) ───────────────────────────────────
  '🥩': 'cut-of-meat',
  '🍖': 'meat-on-bone',
  '🍗': 'poultry-leg',
  '🥓': 'bacon',
  '🐟': 'fish',
  '🐠': 'tropical-fish',
  '🦐': 'shrimp',
  '🦞': 'lobster',
  '🦀': 'crab',
  '🐙': 'octopus',
  '🍤': 'fried-shrimp',
  '🥚': 'egg',

  // ── Produits laitiers, boulangerie ──────────────────────────────────
  '🧀': 'cheese-wedge',
  '🥛': 'glass-of-milk',
  '🍞': 'bread',
  '🥖': 'baguette-bread',
  '🥐': 'croissant',
  '🥨': 'pretzel',
  '🥯': 'bagel',
  '🧈': 'butter',
  '🥞': 'pancakes',
  '🧇': 'waffle',

  // ── Plats préparés ──────────────────────────────────────────────────
  '🍝': 'spaghetti',
  '🍜': 'steaming-bowl',
  '🍲': 'pot-of-food',
  '🍱': 'bento-box',
  '🍙': 'rice-ball',
  '🍣': 'sushi',
  '🍕': 'pizza',
  '🌮': 'taco',
  '🌯': 'burrito',
  '🥗': 'green-salad',
  '🍳': 'cooking',
  '🍔': 'hamburger',
  '🌭': 'hot-dog',
  '🥪': 'sandwich',
  '🍰': 'shortcake',
  '🍪': 'cookie',
  '🍩': 'doughnut',
  '🍫': 'chocolate-bar',
  '🍬': 'candy',
  '🍯': 'honey-pot',
  '🍿': 'popcorn',
  '🧂': 'salt',
  // (🥜 déjà mappé dans la section Légumes plus haut)

  // ── Boissons ────────────────────────────────────────────────────────
  '☕': 'hot-beverage',
  '🍵': 'teacup-without-handle',
  '🍷': 'wine-glass',
  '🍺': 'beer-mug',
  '🍻': 'clinking-beer-mugs',
  '🥂': 'clinking-glasses',
  '🥃': 'tumbler-glass',
  '🍶': 'sake',
  '🍾': 'bottle-with-popping-cork',
  '🧃': 'beverage-box',
  '🥤': 'cup-with-straw',

  // ── Compartiments frigo ─────────────────────────────────────────────
  '❄️': 'snowflake',
  '🧊': 'ice',
  '🥡': 'takeout-box',
  '📅': 'calendar',
  '🗓️': 'spiral-calendar',

  // ── Ustensiles & UX ─────────────────────────────────────────────────
  '🍽️': 'fork-and-knife-with-plate',
  '🍴': 'fork-and-knife',
  '🥄': 'spoon',
  '🔪': 'kitchen-knife',
  '🛒': 'shopping-cart',
  '⭐': 'star',
  '❤️': 'red-heart',
  '🔔': 'bell',
  '✅': 'check-mark-button',
  '❌': 'cross-mark',
  '⚠️': 'warning',
  // (🥗 déjà mappé dans la section Plats préparés)
}

const DOSSIER = `${import.meta.env.BASE_URL}emoji/fluent`

/**
 * Retourne l'URL (sur le site) de l'image Fluent Emoji d'un char, ou null si non mappé.
 * @param {string} char - emoji Unicode (peut inclure variation selectors fe0f)
 * @returns {string|null}
 */
export function getFluentEmojiUrl(char) {
  if (!char) return null
  // Normalisation : retire variation selectors (fe0f, fe0e) pour matcher les clés.
  const normalized = [...char].filter(c => c.codePointAt(0) !== 0xfe0f && c.codePointAt(0) !== 0xfe0e).join('')
  const name = FLUENT_EMOJI_MAP[char] ?? FLUENT_EMOJI_MAP[normalized]
  if (!name) return null
  return `${DOSSIER}/${name}.svg`
}
