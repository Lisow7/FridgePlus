/**
 * Audit DIET_BREAKING_IDS — vérifie la cohérence des "ingrédients qui cassent
 * un régime" par rapport aux libellés de tous les ingrédients.
 *
 * Usage : node scripts/verify-diet-breakers.mjs
 *
 * Pour chaque régime (vegetarian, vegan, gluten-free, dairy-free), on :
 *   1. Identifie les ingrédients dont le libellé suggère qu'ils devraient
 *      casser ce régime (ex: "Bœuf" → casse vegetarian + vegan).
 *   2. Compare avec la table actuelle DIET_BREAKING_IDS.
 *   3. Flag les manques (ingrédient devrait être dans le set, mais pas) et
 *      les extras (présent dans le set mais pas suggéré par le libellé).
 */

import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const { INGREDIENTS }       = await import(pathToFileURL(join(root, 'src/shared/static/ingredients.js')).href)
const { DIET_BREAKING_IDS } = await import(pathToFileURL(join(root, 'src/shared/static/diet-breaking-ids.js')).href)

// Mots-clés multilingues qui indiquent qu'un ingrédient casse un régime.
// Les listes sont volontairement larges pour attraper les faux négatifs.
const DIET_KEYWORDS = {
  vegetarian: {
    description: 'Pas de chair animale (viande, poisson, fruits de mer)',
    keywords: [
      // Viandes FR
      'bœuf', 'boeuf', 'poulet', 'porc', 'veau', 'canard', 'agneau', 'lapin',
      'dinde', 'mouton', 'gibier', 'sanglier', 'cerf', 'cheval',
      'jambon', 'lardon', 'bacon', 'saucisse', 'saucisson', 'chorizo',
      'mortadelle', 'rillette', 'pâté', 'pate-campagne', 'pate-terrine',
      'andouille', 'andouillette', 'foie', 'rognon', 'tripe', 'cervelle',
      'merguez', 'kebab', 'nuggets', 'cordon-bleu', 'magret', 'gigot',
      'escalope', 'côte', 'cote', 'filet', 'entrecôte', 'entrecote', 'bavette',
      'paleron', 'roti', 'rôti', 'hache', 'haché', 'steak',
      // Poissons / fruits de mer FR
      'poisson', 'saumon', 'thon', 'cabillaud', 'truite', 'sardine', 'anchois',
      'maquereau', 'hareng', 'colin', 'lieu', 'lotte', 'sole', 'dorade', 'haddock',
      'bar ', 'aiglefin', 'morue', 'merlu', 'panga', 'tilapia',
      'crevette', 'gambas', 'homard', 'crabe', 'langoustine',
      'moule', 'huître', 'huitre', 'palourde', 'seiche', 'poulpe', 'calmar',
      'calamar', 'surimi', 'caviar',
      'fruits de mer', 'fruits-mer',
      'katsuobushi', 'niboshi', 'sakura-ebi', 'dashi', 'nuoc-mam', 'huitre',
      // Viandes EN
      'beef', 'chicken', 'pork', 'duck', 'lamb', 'turkey', 'rabbit', 'veal',
      'ham', 'bacon', 'sausage', 'salami',
      'fish', 'salmon', 'tuna', 'cod', 'trout', 'shrimp', 'prawn', 'lobster',
      'crab', 'mussel', 'oyster', 'octopus', 'squid', 'scallop',
      // DE
      'rind', 'huhn', 'schwein', 'ente', 'lamm', 'pute', 'kalb',
      'fisch', 'lachs', 'thunfisch',
      // ES
      'ternera', 'pollo', 'cerdo', 'pato', 'cordero',
      'pescado', 'salmon', 'atun', 'gamba',
      // JA
      '牛', '豚', '鶏', '羊', '魚', '鮭', 'マグロ', 'エビ', 'カニ',
    ],
  },
  vegan: {
    description: 'Pas de produit animal (vegetarian + lait + œufs + miel)',
    keywords: [
      // Tout vegetarian +
      // Lait/laitages FR
      'lait', 'fromage', 'beurre', 'yaourt', 'crème', 'creme', 'mozzarella', 'parmesan',
      'gruyère', 'gruyere', 'emmental', 'comté', 'comte', 'cheddar', 'chèvre', 'chevre',
      'feta', 'ricotta', 'burrata', 'brie', 'camembert', 'roquefort', 'reblochon',
      'mascarpone', 'raclette', 'babybel', 'brebis', 'glace', 'tomme', 'munster',
      'fromage blanc', 'kéfir', 'kefir',
      // Œufs FR
      'œuf', 'oeuf',
      // Miel FR
      'miel',
      // Lait/laitages EN
      'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'ice cream',
      // Œufs EN
      'egg',
      // DE
      'milch', 'käse', 'butter', 'joghurt', 'sahne', 'eis',
      'ei', 'honig',
      // ES
      'leche', 'queso', 'mantequilla', 'yogur', 'nata', 'helado',
      'huevo', 'miel',
      // JA
      'ミルク', '牛乳', 'チーズ', 'バター', 'ヨーグルト', 'クリーム',
      '卵', '蜂蜜',
    ],
  },
  'gluten-free': {
    description: 'Pas de gluten (blé, seigle, orge, avoine et dérivés)',
    keywords: [
      // FR
      'blé', 'farine', 'pain', 'pâte', 'pâtes', 'spaghetti', 'tagliatelle',
      'pizza', 'brioche', 'biscuit', 'croissant', 'cookie', 'tarte', 'brownie',
      'gâteau', 'crêpe', 'gnocchi', 'couscous', 'orge', 'seigle', 'avoine',
      'épeautre', 'semoule', 'baguette', 'biscotte', 'ravioli', 'lasagne',
      'penne', 'fusilli', 'tortellini', 'macaroni', 'cannelloni', 'rigatoni',
      'wrap', 'tortilla', 'crouton', 'galette', 'panini', 'pita', 'pâtisserie',
      'patisserie', 'génoise', 'genoise', 'pain perdu',
      // EN
      'bread', 'pasta', 'flour', 'wheat', 'rye', 'barley', 'oat', 'spelt', 'cake', 'cookies',
      // DE
      'brot', 'mehl', 'weizen', 'roggen', 'gerste', 'hafer',
      // ES
      'pan', 'harina', 'trigo', 'centeno', 'cebada', 'avena',
      // JA
      'パン', '小麦', 'パスタ',
    ],
  },
  'dairy-free': {
    description: 'Pas de produit laitier',
    keywords: [
      // FR
      'lait', 'fromage', 'beurre', 'yaourt', 'crème', 'creme', 'mozzarella', 'parmesan',
      'gruyère', 'gruyere', 'emmental', 'comté', 'comte', 'cheddar', 'chèvre', 'chevre',
      'feta', 'ricotta', 'burrata', 'brie', 'camembert', 'roquefort', 'reblochon',
      'mascarpone', 'raclette', 'babybel', 'brebis', 'glace', 'tomme', 'munster',
      'fromage blanc', 'kéfir', 'kefir',
      // EN
      'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'ice cream',
      // DE
      'milch', 'käse', 'butter', 'joghurt', 'sahne', 'eis',
      // ES
      'leche', 'queso', 'mantequilla', 'yogur', 'nata', 'helado',
      // JA
      'ミルク', '牛乳', 'チーズ', 'バター', 'ヨーグルト', 'クリーム',
    ],
  },
}

function suggestsBreakingDiet(item, dietConfig) {
  const allText = `${item.id} ${Object.values(item.labels ?? {}).join(' ')}`.toLowerCase()
  return dietConfig.keywords.some(kw => allText.includes(kw.toLowerCase()))
}

// ─── Run audit ───────────────────────────────────────────────────────────────

const allItems = Object.values(INGREDIENTS).flat()
console.log(`\n🔎  Audit DIET_BREAKING_IDS sur ${allItems.length} ingrédients\n`)

for (const [diet, config] of Object.entries(DIET_KEYWORDS)) {
  const currentSet = DIET_BREAKING_IDS[diet] ?? new Set()
  const expectedToBreak = allItems.filter(item => suggestsBreakingDiet(item, config))
  const expectedIds = new Set(expectedToBreak.map(i => i.id))

  // Manque : ingrédient suggéré comme breaking, mais pas dans le set actuel
  const missing = expectedToBreak.filter(item => !currentSet.has(item.id))
  // Extra : ingrédient dans le set, mais labels ne suggèrent pas qu'il casse ce régime
  const extra = [...currentSet].filter(id => !expectedIds.has(id))
    .map(id => allItems.find(i => i.id === id) ?? { id, labels: { fr: '(non trouvé)' } })

  console.log(`\n━━━ ${diet.toUpperCase()} (${config.description}) ━━━`)
  console.log(`Set actuel : ${currentSet.size} ingrédients`)
  console.log(`Suggérés par labels : ${expectedToBreak.length} ingrédients`)

  if (missing.length) {
    console.log(`\n🚨  ${missing.length} MANQUANTS — devrait casser ${diet} mais absent du set :`)
    missing.forEach(item => console.log(`     • ${item.id}  (${item.labels?.fr})`))
  } else {
    console.log('\n✅  Aucun manquant')
  }

  if (extra.length) {
    console.log(`\n⚠️  ${extra.length} EXTRA — dans le set mais labels ne le suggèrent pas (potentiel faux positif, à vérifier) :`)
    extra.forEach(item => console.log(`     • ${item.id}  (${item.labels?.fr})`))
  }
}

console.log('\n✅  Audit DIET_BREAKING_IDS terminé.\n')
