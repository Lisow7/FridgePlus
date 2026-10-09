/**
 * Applique les disambiguïsations de labels pour les ingrédients qui partagent
 * le même nom (frais vs surgelé vs conserve). Modifie `src/shared/static/ingredients.js`
 * en place.
 *
 * Détecté par `audit-ingredient-duplicates.mjs` v3.28.0 :
 * 29 groupes de labels FR strictement identiques pour des ingrédients
 * physiquement distincts (rayon différent, format différent). L'utilisateur
 * voit alors plusieurs résultats avec le même nom dans la barre de recherche
 * du panier — c'est mauvais pour l'UX.
 *
 * Stratégie : on n'altère **que les IDs « variantes »** (frz-, gp- conserve)
 * et on laisse l'ID « natif » (vg-, fr-) garder son label sans suffixe. Ainsi
 * « Carottes » reste pour `vg-carottes` (le défaut quand on tape « carotte »
 * dans la barre) et `frz-carottes` devient « Carottes (surgelées) ».
 *
 * Usage : node scripts/apply-ingredient-disambiguation.mjs
 *
 * NB : opération idempotente — si le suffixe est déjà présent, on ne le
 * réapplique pas. Safe à relancer.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = resolve(__dirname, '../src/shared/static/ingredients.js')

// ID → suffixes par langue à ajouter aux labels
// Convention : on suffixe les ingrédients « non par défaut » dans la sous-cat
// principale. Le frais (vg-/fr-) garde son label sans suffixe.
const DISAMBIGUATION = {
  // ── Surgelés (frz-) ───────────────────────────────────────────────────
  'frz-poissons':   { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-cabillaud':  { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-daurade':    { fr: ' (surgelée)',  en: ' (frozen)',     es: ' (congelada)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-fruits-mer': { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-crevettes':  { fr: ' (surgelées)', en: ' (frozen)',     es: ' (congeladas)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-moules':     { fr: ' (surgelées)', en: ' (frozen)',     es: ' (congeladas)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-brocoli':    { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-carottes':   { fr: ' (surgelées)', en: ' (frozen)',     es: ' (congeladas)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-champignons':{ fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-chou-fleur': { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-edamame':    { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-epinards':   { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congeladas)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-haricots-v': { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congeladas)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-mais':       { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-petits-pois':{ fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-poireaux':   { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-poivrons':   { fr: ' (surgelés)',  en: ' (frozen)',     es: ' (congelados)', de: ' (TK)',         ja: '（冷凍）' },
  'frz-croissant':  { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-brioche':    { fr: ' (surgelée)',  en: ' (frozen)',     es: ' (congelada)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-baguette':   { fr: ' (surgelée)',  en: ' (frozen)',     es: ' (congelada)',  de: ' (TK)',         ja: '（冷凍）' },
  'frz-pain-mie':   { fr: ' (surgelé)',   en: ' (frozen)',     es: ' (congelado)',  de: ' (TK)',         ja: '（冷凍）' },

  // ── Conserves (gp-) ───────────────────────────────────────────────────
  'gp-mais':        { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
  'gp-petits-pois': { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
  'gp-champignons': { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
  'gp-thon':        { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
  'gp-maquereau':   { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
  'gp-jackfruit':   { fr: ' (conserve)',  en: ' (canned)',     es: ' (en conserva)', de: ' (Dose)',      ja: '（缶詰）' },
}

let src = readFileSync(FILE, 'utf8')
let modified = 0
let skipped = 0

for (const [id, suffixes] of Object.entries(DISAMBIGUATION)) {
  // On capture la ligne `{ id: 'xxx', labels: { fr: '...', en: '...', es: '...', de: '...', ja: '...' }, ... }`
  // Pour chaque label, on ajoute le suffixe s'il n'est pas déjà présent.
  // On utilise une regex globale spécifique à chaque langue pour éviter les collisions.
  const idEsc = id.replace(/[-]/g, '\\-')

  // Trouver la ligne complète de l'ingrédient (heuristique : ligne contenant `id: 'xxx'`)
  const lineRe = new RegExp(`^(\\s*\\{\\s*id:\\s*'${idEsc}',[^\\n]*)$`, 'm')
  const lineMatch = src.match(lineRe)
  if (!lineMatch) {
    console.warn(`  ⚠️  ID non trouvé : ${id}`)
    continue
  }

  let line = lineMatch[1]
  let hasChange = false

  for (const lang of ['fr', 'en', 'es', 'de', 'ja']) {
    const suffix = suffixes[lang]
    // Capture le label entre quotes pour cette langue : `fr: 'Tomate'` ou `fr: 'Tomate (frais)'`
    const labelRe = new RegExp(`(${lang}:\\s*')([^']+)(')`, '')
    const labelMatch = line.match(labelRe)
    if (!labelMatch) continue
    const currentLabel = labelMatch[2]
    if (currentLabel.endsWith(suffix.trim()) || currentLabel.includes(suffix)) {
      // Suffixe déjà présent — idempotent
      continue
    }
    const newLabel = currentLabel + suffix
    line = line.replace(labelRe, `$1${newLabel}$3`)
    hasChange = true
  }

  if (hasChange) {
    src = src.replace(lineMatch[1], line)
    modified++
  } else {
    skipped++
  }
}

writeFileSync(FILE, src, 'utf8')
console.log(`\n✓ Modifications appliquées : ${modified}`)
console.log(`  Idempotents (déjà disambiguïsés) : ${skipped}`)
console.log(`  Fichier mis à jour : ${FILE}`)
