/**
 * Audit : détecte les doublons / labels ambigus dans `src/shared/static/ingredients.js`.
 *
 * 3 catégories de détection :
 *
 *   A. LABELS IDENTIQUES — deux ingrédients différents partagent exactement
 *      le même label FR (ou EN, etc.). Exemple : `frz-carottes` (surgelées)
 *      et `vg-carottes` (fraîches) ont tous deux le label « Carottes ».
 *      L'utilisateur qui tape « carotte » dans la barre voit 2 résultats
 *      identiques sans distinction → polluant pour l'UX.
 *      → Fix : disambiguïser le label (« Carottes (surgelées) ») ou
 *      supprimer l'un des deux si vraiment doublon.
 *
 *   B. SINGULIER/PLURIEL — heuristique : ajout d'un « s », « x », « -al →
 *      -aux ». Détecte « Œuf » vs « Œufs », « Tomate » vs « Tomates », etc.
 *      → Fix : convention « toujours singulier », pluralisation au render
 *      via pluralizeLabel() (cf. mémoire project_ingredient_singular_plural_dedup).
 *
 *   C. LABELS À PARENTHÈSES AMBIGUES — détecte les labels en « Œuf(s) »
 *      qui sont à la fois singulier et pluriel. Pas un bug en soi mais
 *      incohérent avec les autres entrées qui sont en singulier ou pluriel.
 *      → Fix : choisir une forme + pluralizeLabel() au render.
 *
 * Usage : node scripts/audit-ingredient-duplicates.mjs
 *
 * NB : ce script ne modifie aucun fichier — c'est de l'audit en lecture
 * seule. La purge se fait manuellement après revue (cf. PR v3.28.0).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = resolve(__dirname, '../src/shared/static/ingredients.js')

const src = readFileSync(FILE, 'utf8')

// Parse minimaliste : on extrait chaque ligne `{ id: '...', labels: { fr: '...', ...
// On garde id + labelFr + sous-catégorie courante.
function parseIngredients(text) {
  const lines = text.split('\n')
  const out = []
  let currentSubcat = null
  for (const line of lines) {
    // Nouvelle sous-catégorie : `  'subcat-name': [`
    const subcatMatch = line.match(/^\s+'([a-z-]+)':\s*\[/)
    if (subcatMatch) {
      currentSubcat = subcatMatch[1]
      continue
    }
    // Ingrédient : `{ id: 'xxx', labels: { fr: '...', en: '...' }`
    const idMatch  = line.match(/id:\s*'([^']+)'/)
    const frMatch  = line.match(/fr:\s*'([^']+)'/)
    const enMatch  = line.match(/en:\s*'([^']+)'/)
    if (idMatch && frMatch && currentSubcat) {
      out.push({
        id: idMatch[1],
        labelFr: frMatch[1],
        labelEn: enMatch ? enMatch[1] : null,
        subcat: currentSubcat,
      })
    }
  }
  return out
}

function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isSingularPluralPair(a, b) {
  if (a === b) return false
  if (a + 's' === b || b + 's' === a) return true
  if (a + 'x' === b || b + 'x' === a) return true
  if (a.endsWith('al') && a.slice(0, -2) + 'aux' === b) return true
  if (b.endsWith('al') && b.slice(0, -2) + 'aux' === a) return true
  if (a.endsWith('au') && a + 'x' === b) return true
  if (b.endsWith('au') && b + 'x' === a) return true
  return false
}

const ingredients = parseIngredients(src)
console.log(`Total ingrédients parsés : ${ingredients.length}\n`)

// ─── A. Labels strictement identiques ───────────────────────────────────
const byLabel = new Map()
for (const ing of ingredients) {
  const norm = normalize(ing.labelFr)
  if (!byLabel.has(norm)) byLabel.set(norm, [])
  byLabel.get(norm).push(ing)
}
const sameLabelGroups = [...byLabel.values()].filter(g => g.length > 1)

console.log(`>>> A. Labels FR strictement identiques (${sameLabelGroups.length} groupes) :\n`)
for (const group of sameLabelGroups) {
  console.log(`  Label « ${group[0].labelFr} » (${group.length} entrées) :`)
  for (const ing of group) {
    console.log(`    • ${ing.id.padEnd(28)} [${ing.subcat}]`)
  }
  console.log()
}

// ─── B. Singulier/pluriel (heuristique) ─────────────────────────────────
const pluralPairs = []
const seenPairs = new Set()
for (let i = 0; i < ingredients.length; i++) {
  for (let j = i + 1; j < ingredients.length; j++) {
    const a = ingredients[i]
    const b = ingredients[j]
    const aN = normalize(a.labelFr)
    const bN = normalize(b.labelFr)
    if (isSingularPluralPair(aN, bN)) {
      const key = [a.id, b.id].sort().join('|')
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      pluralPairs.push({ a, b, sameSubcat: a.subcat === b.subcat })
    }
  }
}

console.log(`>>> B. Paires singulier/pluriel (${pluralPairs.length}) :\n`)
const samePlural = pluralPairs.filter(p => p.sameSubcat)
const crossPlural = pluralPairs.filter(p => !p.sameSubcat)

if (samePlural.length > 0) {
  console.log(`   B.1 Même sous-catégorie (${samePlural.length}) — candidats fusion :`)
  for (const { a, b } of samePlural) {
    console.log(`     [${a.subcat}] ${a.id} "${a.labelFr}"  ↔  ${b.id} "${b.labelFr}"`)
  }
  console.log()
}
if (crossPlural.length > 0) {
  console.log(`   B.2 Cross sous-catégorie (${crossPlural.length}) — souvent légitimes (frais vs surgelé etc.) :`)
  for (const { a, b } of crossPlural) {
    console.log(`     ${a.id.padEnd(28)} [${a.subcat.padEnd(14)}] "${a.labelFr}"`)
    console.log(`     ${b.id.padEnd(28)} [${b.subcat.padEnd(14)}] "${b.labelFr}"`)
    console.log()
  }
}

// ─── C. Labels avec parenthèses ambiguës (ex: « Œuf(s) ») ───────────────
const parens = ingredients.filter(ing => /\(/.test(ing.labelFr))
console.log(`>>> C. Labels FR avec parenthèses (${parens.length}) — souvent « X(s) » ambigu :\n`)
for (const ing of parens) {
  console.log(`  • ${ing.id.padEnd(28)} [${ing.subcat}] "${ing.labelFr}"`)
}
