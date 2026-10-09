/**
 * Audit : cartographie la couverture pricing par sous-catégorie d'ingrédients.
 *
 * Pour chaque ingrédient de `src/shared/static/ingredients.js`, indique :
 *   - **specific**  : a des packs dans `pricing/<year>.json` (ou packSizes.js)
 *   - **fallback**  : pas de packs spécifiques, retombe sur `defaultPacksByCategory`
 *
 * Sort un rapport markdown actionnable dans `docs/pricing-coverage.md` qui
 * liste les ingrédients manquants par sous-catégorie, classés par priorité
 * (sous-catégories les plus exposées d'abord). Sert de plan pour les
 * sous-PRs E.2/E.3 d'enrichissement par lots.
 *
 * Usage : node scripts/audit-pricing-coverage.mjs
 *
 * NB : read-only — ne modifie aucune donnée.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const { INGREDIENTS } = await import(pathToFileURL(resolve(ROOT, 'src/shared/static/ingredients.js')).href)
const { PACK_SIZES }  = await import(pathToFileURL(resolve(ROOT, 'src/shared/static/pack-sizes.js')).href)

// Charge le pricing JSON courant.
const pricingPath = resolve(ROOT, 'src/shared/static/pricing/2026.json')
const pricing = existsSync(pricingPath)
  ? JSON.parse(readFileSync(pricingPath, 'utf8'))
  : { prices: {} }

// Sous-catégories agrégées / virtuelles à exclure de l'audit pour éviter de
// compter les ingrédients en double :
//   • `bof`              — union dairy + cheese + eggs (cf. ingredients.js)
//   • `today`/`thisweek` — vues planificateur, vides
const SKIP_SUBCATS = new Set(['bof', 'today', 'thisweek'])

// Aplatit l'arbre INGREDIENTS en liste plate avec sous-catégorie. On dédoublonne
// par id pour qu'un ingrédient présent dans plusieurs vues (parent + alias)
// ne soit compté qu'une fois.
const allIngredients = []
const seenIds = new Set()
for (const [subcat, list] of Object.entries(INGREDIENTS)) {
  if (!Array.isArray(list) || SKIP_SUBCATS.has(subcat)) continue
  for (const item of list) {
    if (item?.id && !seenIds.has(item.id)) {
      seenIds.add(item.id)
      allIngredients.push({ ...item, subcat })
    }
  }
}

// v3.42.0 — Détection des "parents abstraits" : un ingrédient dont l'id est
// utilisé comme `group_id` par d'autres ingrédients. Ces parents sont des
// regroupements taxonomiques (ex: « Légumes racines », « Fruits rouges »,
// « Alliums ») et NON des produits achetables. On les exclut de la métrique
// principale de couverture pour ne pas fausser le ratio.
const usedAsParent = new Set()
for (const ing of allIngredients) {
  if (ing.group_id) usedAsParent.add(ing.group_id)
}

// v3.44.0 — Analyse multilingue : on calcule la couverture pour chacune des
// 5 langues supportées, pas seulement FR. Permet d'identifier les langues
// moins couvertes pour orienter les enrichissements futurs.
const LANGS = ['fr', 'en', 'es', 'de', 'ja']

function hasPackInLang(id, lang) {
  return !!(pricing.prices?.[id]?.[lang]?.length) || !!(PACK_SIZES?.[id]?.[lang]?.length)
}

// Pour chaque ingrédient, détermine la couverture par langue.
const coverage = allIngredients.map(ing => {
  const byLang = {}
  for (const lang of LANGS) byLang[lang] = hasPackInLang(ing.id, lang)
  // hasSpecific (legacy, basé sur FR) — pour rétrocompat des stats existantes
  const hasSpecific = byLang.fr
  // Un parent abstrait : utilisé comme group_id ET sans pack spécifique en
  // au moins FR (lang de référence).
  const isAbstractParent = usedAsParent.has(ing.id) && !hasSpecific
  return {
    id: ing.id,
    labelFr: ing.labels?.fr ?? '',
    subcat: ing.subcat,
    hasSpecific,
    isAbstractParent,
    byLang,
  }
})

// Stats globales — distinction "achetables" vs "parents abstraits"
const total       = coverage.length
const buyable     = coverage.filter(c => !c.isAbstractParent)
const buyableTotal = buyable.length
const withPack    = coverage.filter(c => c.hasSpecific).length
const noPack      = total - withPack
const pct         = ((withPack / total) * 100).toFixed(1)
const pctBuyable  = ((withPack / buyableTotal) * 100).toFixed(1)
const abstractCount = coverage.filter(c => c.isAbstractParent).length

// v3.44.0 — Stats par langue (sur les produits achetables uniquement, pour
// une comparaison juste).
function packCountInLang(id, lang) {
  const fromJson = pricing.prices?.[id]?.[lang]?.length ?? 0
  const fromJs   = PACK_SIZES?.[id]?.[lang]?.length ?? 0
  return Math.max(fromJson, fromJs)
}

const langStats = {}
for (const lang of LANGS) {
  const covered = buyable.filter(c => c.byLang[lang]).length
  // Nombre total de packs déclarés dans cette lang (somme sur tous les ingrédients couverts)
  const totalPacks = buyable.reduce((sum, c) => sum + packCountInLang(c.id, lang), 0)
  // Moyenne de packs par ingrédient couvert (qualité de l'offre)
  const avgPacks = covered > 0 ? (totalPacks / covered).toFixed(2) : '0'
  langStats[lang] = {
    covered,
    total: buyableTotal,
    pct: ((covered / buyableTotal) * 100).toFixed(1),
    missing: buyableTotal - covered,
    totalPacks,
    avgPacks,
  }
}

// Ventilation par sous-cat
const bySubcat = new Map()
for (const c of coverage) {
  if (!bySubcat.has(c.subcat)) bySubcat.set(c.subcat, { total: 0, withPack: 0, missing: [] })
  const s = bySubcat.get(c.subcat)
  s.total++
  if (c.hasSpecific) s.withPack++
  else s.missing.push({ id: c.id, label: c.labelFr })
}

// Tri par nombre de missings DESC (priorité aux sous-cats les plus exposées)
const subcats = [...bySubcat.entries()]
  .map(([subcat, s]) => ({ subcat, ...s, missingCount: s.missing.length }))
  .sort((a, b) => b.missingCount - a.missingCount)

// ─── Rapport markdown ────────────────────────────────────────────────────
const lines = []
lines.push('# Audit couverture pricing — v3.31.0 (Phase E.1)')
lines.push('')
lines.push(`> Généré le ${new Date().toISOString().slice(0, 10)} par \`scripts/audit-pricing-coverage.mjs\``)
lines.push('')
lines.push('Ce rapport cartographie la couverture des **packs grande surface** pour chaque ingrédient de la base. Sert de plan pour les sous-PRs E.2/E.3 d\'enrichissement par lots.')
lines.push('')
lines.push('## Stats globales')
lines.push('')
lines.push(`| Métrique | Valeur |`)
lines.push(`|---|---|`)
lines.push(`| Ingrédients totaux | **${total}** |`)
lines.push(`| Dont parents abstraits (regroupements non achetables) | ${abstractCount} |`)
lines.push(`| **Produits réellement achetables** | **${buyableTotal}** |`)
lines.push(`| Avec packs spécifiques | ${withPack} |`)
lines.push(`| Sans packs (fallback subcat) | ${noPack} |`)
lines.push(`| **Couverture brute (sur total)** | **${pct} %** |`)
lines.push(`| **Couverture corrigée (sur achetables)** | **${pctBuyable} %** |`)
lines.push(`| Sous-catégories | ${subcats.length} |`)
lines.push('')
lines.push('## Couverture par langue (sur produits achetables)')
lines.push('')
lines.push('La langue de référence est `fr`. Les autres langues peuvent avoir moins d\'entrées (variantes spécifiques par marché — pack 1.5L au UK, 5kg de riz au JP, etc.). Une lang à <70 % indique un manque qui orientera les prochains enrichissements.')
lines.push('')
lines.push('| Langue | Couverts | Manquants | % couvert | Total packs | Moy/ingrédient |')
lines.push('|---|---:|---:|---:|---:|---:|')
const langLabels = { fr: '🇫🇷 Français', en: '🇬🇧 English', es: '🇪🇸 Español', de: '🇩🇪 Deutsch', ja: '🇯🇵 日本語' }
for (const lang of LANGS) {
  const s = langStats[lang]
  lines.push(`| ${langLabels[lang]} (\`${lang}\`) | ${s.covered} | ${s.missing} | **${s.pct} %** | ${s.totalPacks} | ${s.avgPacks} |`)
}
lines.push('')
lines.push('La colonne **Moy/ingrédient** indique la richesse de l\'offre par langue : 2-3 packs par ingrédient = bonne couverture des formats (mini/standard/familial). Un nombre faible signale qu\'il faut enrichir les variantes de tailles dans cette langue.')
lines.push('')
lines.push('## Légende')
lines.push('')
lines.push('- **`subcat`** — clé de sous-catégorie dans `INGREDIENTS`')
lines.push('- **`avec`** — ingrédients ayant des packs spécifiques (dans `pricing/<year>.json` ou `packSizes.js`)')
lines.push('- **`manquants`** — ingrédients qui retombent sur `defaultPacksByCategory.js` (couverture générique, pas idéale)')
lines.push('')
lines.push('## Couverture par sous-catégorie')
lines.push('')
lines.push('| Sous-catégorie | Total | Avec | Manquants | % couvert |')
lines.push('|---|---:|---:|---:|---:|')
for (const s of subcats) {
  const sPct = s.total > 0 ? ((s.withPack / s.total) * 100).toFixed(0) : '—'
  lines.push(`| \`${s.subcat}\` | ${s.total} | ${s.withPack} | **${s.missingCount}** | ${sPct} % |`)
}
lines.push('')

// Détail des manquants par sous-cat (limite aux 15 plus exposées pour rester lisible)
lines.push('## Détail — ingrédients sans pack spécifique')
lines.push('')
lines.push('Top 15 sous-catégories les plus exposées (priorité pour E.2/E.3) :')
lines.push('')

for (const s of subcats.slice(0, 15)) {
  if (s.missingCount === 0) continue
  lines.push(`### \`${s.subcat}\` — ${s.missingCount} manquants`)
  lines.push('')
  for (const m of s.missing) {
    lines.push(`- \`${m.id}\` — « ${m.label} »`)
  }
  lines.push('')
}

if (subcats.length > 15) {
  const rest = subcats.slice(15).filter(s => s.missingCount > 0)
  if (rest.length > 0) {
    lines.push(`### Autres sous-catégories (${rest.length})`)
    lines.push('')
    for (const s of rest) {
      lines.push(`- \`${s.subcat}\` — ${s.missingCount} manquants`)
    }
    lines.push('')
  }
}

lines.push('## Plan d\'action suggéré')
lines.push('')
lines.push('1. **E.2** (PR ~30 ingrédients) — couvrir les sous-catégories les plus exposées : viandes, poissons, fruits, légumes manquants.')
lines.push('2. **E.3** — couvrir les épices, sauces, condiments restants.')
lines.push('3. **E.4** — cuisine japonaise (`jp-`) au cas par cas (rayons spécialisés).')
lines.push('4. Chaque PR enrichit `src/shared/static/pricing/<year>.json` directement (Phase D), ne touche pas `packSizes.js`.')
lines.push('')

// Écriture du rapport
const docsDir = resolve(ROOT, 'docs')
if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true })
const outFile = resolve(docsDir, 'pricing-coverage.md')
writeFileSync(outFile, lines.join('\n') + '\n', 'utf8')

// Console summary
console.log(`Total ingrédients : ${total}`)
console.log(`  - parents abstraits (taxonomiques) : ${abstractCount}`)
console.log(`  - produits achetables              : ${buyableTotal}`)
console.log(`  - avec packs spécifiques           : ${withPack}`)
console.log(`Couverture brute    : ${pct} %`)
console.log(`Couverture corrigée : ${pctBuyable} % (sur produits achetables)`)
console.log(`Sous-catégories     : ${subcats.length}`)
console.log(`\nCouverture par langue (sur achetables) :`)
for (const lang of LANGS) {
  const s = langStats[lang]
  console.log(`  ${lang}  ${s.pct.padStart(5)} % (${s.covered}/${s.total}) — ${s.totalPacks} packs (~${s.avgPacks}/ingrédient)`)
}
console.log(`\nTop 5 sous-catégories les plus exposées :`)
for (const s of subcats.slice(0, 5)) {
  console.log(`  ${s.subcat.padEnd(18)} ${s.missingCount} manquants / ${s.total}`)
}
console.log(`\n✓ Rapport écrit : ${outFile}`)
