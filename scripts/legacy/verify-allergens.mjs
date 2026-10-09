/**
 * Audit allergènes/régimes — vérifie la cohérence pour tous les ingrédients.
 *
 * Croise les libellés FR/EN/ES/DE/JA des ingrédients avec les allergènes
 * détectés par l'heuristique de migrate-to-db.mjs, et flag les écarts.
 *
 * Usage : node scripts/verify-allergens.mjs
 *
 * Les ingrédients flagués peuvent être ajoutés à ALLERGEN_OVERRIDES dans
 * migrate-to-db.mjs pour forcer la détection correcte.
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const { INGREDIENTS } = await import(pathToFileURL(join(root, 'src/shared/static/ingredients.js')).href)

// Mots-clés multilingues qui indiquent un allergène potentiel.
// Si un ingrédient a un de ces mots dans n'importe quelle langue, il devrait
// avoir l'allergène correspondant déclaré.
const ALLERGEN_KEYWORDS = {
  gluten: [
    // FR
    'pain', 'pâte', 'pates', 'spaghetti', 'tagliatelle', 'farine', 'pizza', 'brioche',
    'biscuit', 'croissant', 'cookie', 'tarte', 'brownie', 'gâteau', 'gateau', 'crêpe', 'crepe',
    'gnocchi', 'couscous', 'orge', 'seigle', 'avoine', 'épeautre', 'epeautre', 'semoule',
    'baguette', 'biscotte', 'ravioli', 'lasagne', 'penne', 'fusilli', 'tortellini',
    'macaroni', 'cannelloni', 'rigatoni', 'tagliatelles', 'fettuccine', 'gnocchis',
    'blé', 'ble', 'wrap', 'tortilla', 'crouton', 'galette', 'panini', 'pita',
    // EN
    'bread', 'pasta', 'flour', 'wheat', 'rye', 'barley', 'oat', 'spelt', 'cake', 'crepe',
    // DE
    'brot', 'mehl', 'weizen', 'roggen', 'gerste', 'hafer', 'kuchen',
    // ES
    'pan', 'harina', 'trigo', 'centeno', 'cebada', 'avena',
    // JA
    'パン', '小麦', 'パスタ',
  ],
  milk: [
    // FR
    'lait', 'fromage', 'beurre', 'yaourt', 'crème', 'creme', 'mozzarella', 'parmesan',
    'gruyère', 'gruyere', 'emmental', 'comté', 'comte', 'cheddar', 'chèvre', 'chevre',
    'feta', 'ricotta', 'burrata', 'brie', 'camembert', 'roquefort', 'reblochon',
    'mascarpone', 'raclette', 'babybel', 'brebis', 'glace', 'crème fraîche',
    'fromage blanc', 'yaourts', 'fromages', 'tomme', 'munster', 'bleu', 'bûche',
    // EN
    'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'ice cream',
    // DE
    'milch', 'käse', 'kase', 'butter', 'joghurt', 'sahne', 'eis',
    // ES
    'leche', 'queso', 'mantequilla', 'yogur', 'nata', 'helado',
    // JA
    'ミルク', '牛乳', 'チーズ', 'バター', 'ヨーグルト', 'クリーム',
  ],
  eggs: [
    // FR
    'œuf', 'oeuf',
    // EN
    'egg',
    // DE
    'ei',
    // ES
    'huevo',
    // JA
    '卵',
  ],
  nuts: [
    // FR
    'amande', 'noisette', 'noix', 'pistache', 'pécan', 'pecan', 'cajou', 'macadamia', 'pignon',
    // EN
    'almond', 'hazelnut', 'walnut', 'pistachio', 'cashew',
    // DE
    'mandel', 'haselnuss', 'walnuss',
    // ES
    'almendra', 'avellana', 'nuez', 'pistacho',
    // JA
    'アーモンド', 'ヘーゼルナッツ', 'ピスタチオ',
  ],
  peanuts: [
    'cacahuète', 'cacahuete', 'peanut', 'arachide',
    'Erdnuss', 'cacahuate',
  ],
  soybeans: [
    'soja', 'tofu', 'tempeh', 'edamame', 'miso',
    'soy', 'soya',
    'sojabohne',
    'soja',
    '大豆', '豆腐', 'ミソ',
  ],
  fish: [
    // FR (sans confondre avec viandes)
    'poisson', 'saumon', 'thon', 'cabillaud', 'merlu', 'truite', 'sardine',
    'anchois', 'maquereau', 'hareng', 'colin', 'lieu', 'lotte', 'sole', 'dorade',
    'haddock', 'aiglefin', 'morue', 'bar ', // espace pour éviter "bardiche"
    // EN
    'fish', 'salmon', 'tuna', 'cod', 'trout', 'sardine', 'anchovy', 'mackerel', 'herring',
    // DE
    'fisch', 'lachs', 'thunfisch', 'kabeljau', 'forelle',
    // ES
    'pescado', 'salmón', 'salmon', 'atún', 'atun', 'bacalao',
    // JA
    '魚', '鮭', 'マグロ', 'タラ',
  ],
  crustaceans: [
    'crevette', 'gambas', 'homard', 'crabe', 'langoustine', 'écrevisse', 'ecrevisse',
    'shrimp', 'prawn', 'lobster', 'crab',
    'garnele', 'hummer', 'krabbe',
    'gamba', 'langosta', 'cangrejo',
    'エビ', 'カニ',
  ],
  molluscs: [
    'moule', 'huître', 'huitre', 'palourde', 'seiche', 'poulpe', 'calamar', 'calmar',
    'bulot', 'escargot', 'coquille', 'pétoncle',
    'mussel', 'oyster', 'octopus', 'squid', 'clam', 'scallop',
    'muschel', 'auster', 'tintenfisch',
    'mejillón', 'ostra', 'pulpo', 'calamar',
  ],
  celery: ['céleri', 'celeri', 'celery', 'sellerie', 'apio', 'セロリ'],
  mustard: ['moutarde', 'mustard', 'senf', 'mostaza', 'マスタード'],
  sesame: ['sésame', 'sesame', 'tahini', 'tahin', 'sesam', 'ajonjolí', 'ゴマ', 'ごま'],
  sulphites: ['vin blanc', 'vin rouge', 'vinaigre'],
  lupin: ['lupin'],
}

// Réimplémente l'heuristique inferAllergensFromIngredientId (copie depuis migrate-to-db)
const ALLERGEN_OVERRIDES = {
  'gp-vermicelles': ['soybeans', 'gluten'],
}

function inferAllergensFromIngredientId(id) {
  if (ALLERGEN_OVERRIDES[id]) return [...ALLERGEN_OVERRIDES[id]]
  const allergens = []
  if (/(pain|pates|spaghetti|tagliatelles|farine|pizza|brioche|biscuit|croissant|cookies|pain-perdu|tarte|brownie|gateau|crepe|gnocchi|couscous|orge|seigle|avoine|epeautre|semoule)/i.test(id)) allergens.push('gluten')
  if (/(oeuf|egg)/i.test(id)) allergens.push('eggs')
  if (/(lait|fromage|beurre|yaourt|creme|mozzarella|parmesan|gruyere|emmental|comte|cheddar|chevre|feta|ricotta|burrata|brie|camembert|roquefort|reblochon|mascarpone|raclette|babybel|brebis)/i.test(id)) allergens.push('milk')
  if (/(amande|noisette|noix|pistache|pecan|cajou|macadamia|pignon)/i.test(id)) allergens.push('nuts')
  if (/(cacahuete|peanut|arachide)/i.test(id)) allergens.push('peanuts')
  if (/(soja|tofu|tempeh|edamame|miso|sauce-soja)/i.test(id)) allergens.push('soybeans')
  if (/(poisson|saumon|thon|cabillaud|merlu|truite|sardine|anchois|maquereau|hareng|colin|lieu|bar|lotte|sole|dorade|haddock)/i.test(id)) allergens.push('fish')
  if (/(crevette|gamba|homard|crabe|langoustine|ecrevisse|lobster|shrimp|prawn)/i.test(id)) allergens.push('crustaceans')
  if (/(moule|coquillage|huitre|palourde|seiche|poulpe|calamar|bulot|escargot|coquille)/i.test(id)) allergens.push('molluscs')
  if (/(celeri)/i.test(id)) allergens.push('celery')
  if (/(moutarde)/i.test(id)) allergens.push('mustard')
  if (/(sesame|tahini|tahin)/i.test(id)) allergens.push('sesame')
  if (/(vin-blanc|vin-rouge|vinaigre)/i.test(id)) allergens.push('sulphites')
  if (/(lupin)/i.test(id)) allergens.push('lupin')
  return allergens
}

// Détecte les allergènes attendus à partir des labels (toutes langues)
// Utilise des word boundaries pour éviter les faux positifs (ex: "Reis" allemand
// pour "rice" ne devrait pas matcher "ei" pour "egg" en allemand).
function detectExpectedAllergens(labels) {
  const allergens = new Set()
  const allText = Object.values(labels ?? {}).join(' ').toLowerCase()
  // Pour chaque allergen, on construit un regex avec word boundaries
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase().trim()
      if (!lowerKw) continue
      // Pour les caractères CJK (japonais), pas de word boundary — substring
      const isCJK = /[一-鿿぀-ゟ゠-ヿ]/.test(lowerKw)
      let matched = false
      if (isCJK) {
        matched = allText.includes(lowerKw)
      } else {
        const escapedKw = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedKw}\\b`, 'iu')
        matched = regex.test(allText)
      }
      if (matched) {
        allergens.add(allergen)
        break
      }
    }
  }
  return Array.from(allergens).sort()
}

// ─── Run audit ───────────────────────────────────────────────────────────────

const allItems = Object.values(INGREDIENTS).flat()
console.log(`\n🔎  Audit allergènes sur ${allItems.length} ingrédients\n`)

const issues = []
for (const item of allItems) {
  const detected  = inferAllergensFromIngredientId(item.id).sort()
  const expected  = detectExpectedAllergens(item.labels)
  // Allergènes attendus mais non détectés
  const missing   = expected.filter(a => !detected.includes(a))
  // Allergènes détectés mais non attendus (potentiel faux positif)
  const extra     = detected.filter(a => !expected.includes(a))
  if (missing.length || extra.length) {
    issues.push({ id: item.id, fr: item.labels?.fr, missing, extra, detected, expected })
  }
}

console.log(`📋  ${issues.length} ingrédients avec écart entre détection (regex ID) et attendu (mots-clés labels)\n`)

const missingByAllergen = {}
const falsePositives = []
for (const i of issues) {
  if (i.missing.length) {
    for (const a of i.missing) {
      if (!missingByAllergen[a]) missingByAllergen[a] = []
      missingByAllergen[a].push(`${i.id}  (${i.fr})`)
    }
  }
  if (i.extra.length) {
    falsePositives.push({ id: i.id, fr: i.fr, extra: i.extra })
  }
}

console.log('━━━ ALLERGÈNES MANQUANTS (à ajouter aux overrides ou à enrichir la regex) ━━━\n')
for (const [allergen, items] of Object.entries(missingByAllergen)) {
  console.log(`\n🚨  ${allergen.toUpperCase()} — ${items.length} ingrédients :`)
  items.forEach(line => console.log(`     • ${line}`))
}

if (falsePositives.length) {
  console.log('\n\n━━━ FAUX POSITIFS POSSIBLES (allergène détecté mais pas indiqué dans le label) ━━━\n')
  falsePositives.forEach(({ id, fr, extra }) => {
    console.log(`  • ${id}  (${fr})  → détecté à tort : ${extra.join(', ')}`)
  })
}

console.log(`\n✅  Audit terminé. ${Object.keys(missingByAllergen).length} catégories d'allergènes ont des manques, ${falsePositives.length} faux positifs.\n`)
