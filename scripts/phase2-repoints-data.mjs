/**
 * Données + helpers partagés du re-pointage Phase 2 (Niveau B).
 * Source unique pour `analyze-phase2-repoints.mjs` (lecture) et
 * `apply-phase2-repoints.mjs` (écriture).
 *
 * Sémantique (vérifiée Phase 1) : diet = union pessimiste (un régime est cassé
 * dès qu'une alternative d'un slot le casse) ; allergènes = union de toutes les
 * alternatives. On ne s'en sert QUE pour calculer le DELTA d'un swap (l'écriture
 * applique ce delta aux valeurs STOCKÉES, jamais une re-dérivation union).
 */

export const ALL_DIETS = ['vegan', 'vegetarian', 'gluten-free', 'dairy-free']

// [recipe, op:'swap'|'add', oldId|null, newId]
export const CANDIDATES = [
  ['albondigas', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['baklava', 'swap', 'fr-pate-feuilletee', 'gp-pate-filo'],
  ['burritos-boeuf', 'swap', 'gp-tortillas', 'gp-tortillas-ble'],
  ['burritos-haricots', 'swap', 'gp-tortillas', 'gp-tortillas-ble'],
  ['butter-chicken', 'swap', 'sp-curry', 'sp-garam-masala'],
  ['cafe-vietnamien', 'swap', 'fr-lait', 'gp-lait-concentre-sucre'],
  ['cannelloni-ricotta-epinards', 'swap', 'gp-lasagnes-sec', 'gp-cannelloni'],
  ['cannoli', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['che-banane-coco', 'swap', 'gp-chia', 'gp-tapioca'],
  ['crevettes-citronnelle', 'add', null, 'sp-citronnelle'],
  ['dal-makhani', 'swap', 'sp-curry', 'sp-garam-masala'],
  ['dorayaki', 'swap', 'gp-haricots-rouges', 'gp-azuki'],
  ['energy-balls', 'swap', 'fr-noix-coco', 'gp-coco-rapee'],
  ['fabada-asturiana', 'add', null, 'fr-morcilla'],
  ['feta-au-four-miel', 'swap', 'fr-pate-feuilletee', 'gp-pate-filo'],
  ['choucroute-garnie', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['cornbread', 'swap', 'gp-semoule', 'gp-farine-mais'],
  ['gnocchi-gorgonzola', 'swap', 'fr-fourme', 'fr-gorgonzola'],
  ['gnocchi-tomate', 'swap', 'gp-pates', 'gp-gnocchi'],
  ['gumbo', 'swap', 'fr-chorizo', 'fr-saucisse-fumee'],
  ['gyros-poulet', 'swap', 'gp-pain', 'gp-pain-pita'],
  ['iced-tea-citron', 'swap', 'gp-cafe', 'gp-the-noir'],
  ['japchae', 'swap', 'jp-harusame', 'jp-dangmyeon'],
  ['jeyuk-bokkeum', 'swap', 'sp-sambal-oelek', 'sp-gochujang'],
  ['mapo-tofu', 'swap', 'sp-sambal-oelek', 'sp-doubanjiang'],
  ['mapo-tofu', 'swap', 'fr-echine', 'fr-porc-hache'],
  ['nachos-gratines', 'swap', 'gp-tortillas', 'gp-chips-tortilla'],
  ['nems', 'swap', 'fr-echine', 'fr-porc-hache'],
  ['nouilles-dan-dan', 'swap', 'fr-echine', 'fr-porc-hache'],
  ['key-lime-pie', 'swap', 'fr-lait', 'gp-lait-concentre-sucre'],
  ['kimchi-jjigae', 'swap', 'sp-sambal-oelek', 'sp-gochujang'],
  ['korma-poulet', 'swap', 'sp-curry', 'sp-garam-masala'],
  ['lapin-moutarde', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['magret-sauce-poivre', 'swap', 'sp-poivre-rose', 'sp-poivre-vert'],
  ['magret-sauce-poivre', 'swap', 'gp-vin-rouge-cuis', 'gp-cognac'],
  ['osso-buco', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['polenta-champignons', 'swap', 'gp-semoule', 'gp-polenta'],
  ['polenta-cremeuse', 'swap', 'gp-semoule', 'gp-polenta'],
  ['pollo-al-ajillo', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['poulet-coreen-frit', 'swap', 'sp-sambal-oelek', 'sp-gochujang'],
  ['poulet-bowl-gochujang', 'swap', 'sp-sambal-oelek', 'sp-gochujang'],
  ['poulet-grille-citronnelle', 'add', null, 'sp-citronnelle'],
  ['pasta-puttanesca', 'add', null, 'sp-capres'],
  ['pastilla-poulet', 'swap', 'fr-pate-feuilletee', 'gp-feuille-brick'],
  ['poelee-gnocchi-legumes', 'swap', 'gp-pates', 'gp-gnocchi'],
  ['risotto-asperges', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['risotto-fruits-mer', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['saganaki', 'swap', 'fr-feta', 'fr-kefalotyri'],
  ['salade-chou-chinois-sesame', 'swap', 'vg-chou', 'vg-chou-chinois'],
  ['tofu-citronnelle', 'add', null, 'sp-citronnelle'],
  ['tom-yum', 'add', null, 'sp-citronnelle'],
  ['tom-yum', 'add', null, 'sp-galanga'],
  ['salsa-verde-mexicaine', 'swap', 'vg-tomate', 'vg-tomatillo'],
  ['saltimbocca', 'swap', 'gp-vin-rouge-cuis', 'gp-vin-blanc-cuis'],
  ['samoussas-legumes', 'swap', 'fr-pate-feuilletee', 'gp-feuille-brick'],
  ['tomates-farcies', 'swap', 'fr-hache-boeuf', 'fr-chair-saucisse'],
  ['tonkatsu', 'swap', 'sp-sauce-bbq', 'sp-sauce-tonkatsu'],
  ['tyropita', 'swap', 'fr-pate-feuilletee', 'gp-pate-filo'],
  ['wrap-poulet', 'swap', 'gp-tortillas', 'gp-tortillas-ble'],
  ['wrap-vegetarien', 'swap', 'gp-tortillas', 'gp-tortillas-ble'],
  ['wrap-vegetarien', 'swap', 'gp-pois-chiches', 'gp-houmous'],
  ['soupe-cresson', 'swap', 'vg-salade', 'vg-cresson'],
  ['soupe-haricots-noirs', 'swap', 'gp-haricots-rouges', 'gp-haricots-noirs'],
  ['soupe-tom-kha', 'add', null, 'sp-galanga'],
  ['soupe-tom-kha', 'add', null, 'sp-citronnelle'],
  ['spanakopita', 'swap', 'fr-pate-feuilletee', 'gp-pate-filo'],
  ['spaghetti-cacio-e-pepe', 'swap', 'fr-parmesan', 'fr-pecorino'],
]

// Slot étiqueté pour les ops 'add' — clé = `${recipe}|${newId}` (spec §5).
export const ADD_SLOTS = {
  'crevettes-citronnelle|sp-citronnelle': { qty: { amount: 1, unit: 'pcs' }, labels: { fr: '1 tige de citronnelle', en: '1 lemongrass stalk' } },
  'poulet-grille-citronnelle|sp-citronnelle': { qty: { amount: 2, unit: 'pcs' }, labels: { fr: '2 tiges de citronnelle', en: '2 lemongrass stalks' } },
  'tofu-citronnelle|sp-citronnelle': { qty: { amount: 1, unit: 'pcs' }, labels: { fr: '1 tige de citronnelle', en: '1 lemongrass stalk' } },
  'tom-yum|sp-citronnelle': { qty: { amount: 2, unit: 'pcs' }, labels: { fr: '2 tiges de citronnelle', en: '2 lemongrass stalks' } },
  'tom-yum|sp-galanga': { qty: { amount: 20, unit: 'g' }, labels: { fr: '20 g de galanga', en: '20g galangal' } },
  'soupe-tom-kha|sp-galanga': { qty: { amount: 20, unit: 'g' }, labels: { fr: '20 g de galanga', en: '20g galangal' } },
  'soupe-tom-kha|sp-citronnelle': { qty: { amount: 1, unit: 'pcs' }, labels: { fr: '1 tige de citronnelle', en: '1 lemongrass stalk' } },
  'pasta-puttanesca|sp-capres': { qty: { amount: 2, unit: 'cs' }, labels: { fr: '2 c. à soupe de câpres', en: '2 tbsp capers' } },
  'fabada-asturiana|fr-morcilla': { qty: { amount: 200, unit: 'g' }, labels: { fr: '200 g de morcilla', en: '200g morcilla' } },
}

// union allergènes + diet (pessimiste) sur l'état courant des slots.
export function compute(slots, ING) {
  const al = new Set(), broken = new Set()
  for (const slot of slots) {
    for (const id of slot.ids ?? []) {
      const ing = ING.get(id)
      if (!ing) continue
      for (const a of ing.allergens ?? []) al.add(a)
      for (const b of ing.breaks_diets ?? []) broken.add(b)
    }
  }
  return { al: [...al].sort(), diet: ALL_DIETS.filter(d => !broken.has(d)).sort() }
}

// applique une op aux slots ; renvoie de NOUVEAUX slots (immuable).
export function applyOp(slots, recipe, op, oldId, newId) {
  if (op === 'swap') {
    return slots.map(slot => {
      const ids = slot.ids ?? []
      return ids.includes(oldId) ? { ...slot, ids: ids.map(x => (x === oldId ? newId : x)) } : slot
    })
  }
  // add : nouveau slot étiqueté requis
  const meta = ADD_SLOTS[`${recipe}|${newId}`]
  const slot = { ids: [newId], required: true, ...(meta?.qty ? { qty: meta.qty } : {}), ...(meta?.labels ? { labels: meta.labels } : {}) }
  return [...slots, slot]
}

export function classify(before, after) {
  const alAdded = after.al.filter(a => !before.al.includes(a))
  const alRemoved = before.al.filter(a => !after.al.includes(a))
  const dietAdded = after.diet.filter(d => !before.diet.includes(d))     // plus permissif
  const dietRemoved = before.diet.filter(d => !after.diet.includes(d))   // plus restrictif
  let klass
  if (!alAdded.length && !alRemoved.length && !dietAdded.length && !dietRemoved.length) klass = 'ZERO'
  else if (dietAdded.length || alRemoved.length) klass = 'PERMISSIF'
  else klass = 'RESTRICTIF'
  return { klass, alAdded, alRemoved, dietAdded, dietRemoved }
}

// charge .env.local + client service-role (partagé par les deux scripts).
export function loadClient(createClient, readFileSync) {
  const env = {}
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
