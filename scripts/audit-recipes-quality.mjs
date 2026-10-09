/**
 * Pré-scan QUALITÉ TECHNIQUE des recettes officielles (lecture seule, aucune écriture).
 *
 * Détecte 3 familles d'anomalies que les validateurs d'import existants ne couvrent pas :
 *   A. Paramètre technique manquant — friture / four sans température.
 *   B. Incohérence id principal ↔ label — le texte du slot correspond à une
 *      ALTERNATIVE (ids[1+]) et PAS à l'id principal (ids[0]). Ex. tonkatsu :
 *      ids=[fr-echine, fr-cote-porc, …], label « côtes de porc » → matche l'alt.
 *   C. Ingrédient « substantiel » cité dans une étape mais absent de la liste
 *      (basse confiance — bruyant, à filtrer par revue humaine).
 *
 * Données : table `recipes_unified` (colonnes À PLAT — jamais `data`) + `ingredients`.
 * Connexion : .env.local (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), cf. audit-recipes.mjs.
 * Usage : node scripts/audit-recipes-quality.mjs
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envFile = join(root, '.env.local')
  if (!existsSync(envFile)) return {}
  const env = {}
  for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = { ...loadEnv(), ...process.env }
const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Env Supabase manquantes (.env.local : VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// — Helpers texte —
const fold = (t) => (t ?? '')
  .toLowerCase()
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les diacritiques
const STOP = new Set(['de', 'la', 'le', 'les', 'du', 'des', 'au', 'aux', 'a', 'et', 'en', 'd', 'l'])
// premier token « distinctif » d'un label canonique (la tête : Échine, Côte, Filet, Tofu…)
const headToken = (label) => fold(label).split(/[\s,'’()-]+/).filter(w => w.length >= 3 && !STOP.has(w))[0] ?? ''

// — Chargement données —
const { data: ingredients, error: ingErr } = await supabase.from('ingredients').select('id, labels, subcategory')
if (ingErr) { console.error('Lecture ingredients :', ingErr.message); process.exit(1) }
const catalog = new Map(ingredients.map(i => [i.id, { label: i.labels?.fr ?? '', subcat: i.subcategory ?? null }]))
const catLabel = (id) => catalog.get(id)?.label ?? ''
const catSubcat = (id) => catalog.get(id)?.subcat ?? null

const { data: recipes, error: recErr } = await supabase
  .from('recipes_unified').select('id, name, ingredients, steps').eq('origin', 'official')
if (recErr) { console.error('Lecture recipes_unified :', recErr.message); process.exit(1) }

// — Détecteurs —
const A = [] // friture/four sans temp
const B = [] // id principal ↔ label
const C = [] // ingrédient cité en étape absent de la liste

const RE_FRY = /(frire|friture|bain d['’ ]?huile|huile chaude|faire frire|grande friture)/i
const RE_OVEN = /(enfourner|au four|pr[ée]chauff|thermostat)/i
const RE_TEMP = /[0-9]{2,3}\s?°/
const RE_TH = /th\.?\s?[0-9]/i
// ingrédients « substantiels » pour C : on ignore les basiques (souvent en étape, pas listés)
const C_IGNORE = new Set(['sel', 'poivre', 'eau', 'huile', 'sucre', 'farine', 'beurre', 'ail', 'oignon', 'persil', 'epices', 'vinaigre', 'bouillon'])

for (const r of recipes) {
  const nom = r.name?.fr ?? r.id
  const stepsFr = Array.isArray(r.steps?.fr) ? r.steps.fr : []
  const stepsTxt = stepsFr.join(' ')
  const stepsFold = fold(stepsTxt)
  const slots = Array.isArray(r.ingredients) ? r.ingredients : []

  // A —
  const hasTemp = RE_TEMP.test(stepsTxt) || RE_TH.test(stepsTxt)
  if (RE_FRY.test(stepsTxt) && !hasTemp) A.push({ id: r.id, nom, type: 'friture', extrait: (stepsFr.find(s => RE_FRY.test(s)) ?? '').slice(0, 90) })
  else if (RE_OVEN.test(stepsTxt) && !hasTemp) A.push({ id: r.id, nom, type: 'four', extrait: (stepsFr.find(s => RE_OVEN.test(s)) ?? '').slice(0, 90) })

  // B — pour chaque slot, le label matche-t-il l'id principal, ou seulement une alternative ?
  const recipeHeads = new Set()
  for (const slot of slots) {
    const ids = Array.isArray(slot.ids) ? slot.ids : (slot.id ? [slot.id] : [])
    if (!ids.length) continue
    const labelFold = fold(slot.labels?.fr ?? '')
    const heads = ids.map(id => ({ id, head: headToken(catLabel(id)), subcat: catSubcat(id) }))
    heads.forEach(h => h.head && recipeHeads.add(h.head))
    const primary = heads[0]
    const primaryMatches = primary.head && labelFold.includes(primary.head)
    if (primaryMatches) continue
    const altMatch = heads.slice(1).find(h => h.head && labelFold.includes(h.head))
    // Haute précision : on ne retient que les mismatches INTER-sous-catégories
    // (ex. porc haché → bœuf haché). Même sous-catégorie = label générique
    // légitime (poulet/blanc-poulet, cheddar/fromage râpé) → ignoré.
    if (altMatch && primary.subcat && altMatch.subcat && primary.subcat !== altMatch.subcat) {
      B.push({ id: r.id, nom, slot: slot.labels?.fr ?? '', principal: primary.id, principalLabel: catLabel(primary.id), principalSubcat: primary.subcat, altMatchee: altMatch.id, altLabel: catLabel(altMatch.id), altSubcat: altMatch.subcat })
    }
  }

  // C — ingrédient substantiel cité dans une étape mais dont la tête n'est pas dans la recette
  for (const [, { label }] of catalog) {
    const h = headToken(label)
    if (!h || h.length < 5 || C_IGNORE.has(h) || recipeHeads.has(h)) continue
    // mot entier dans le texte des étapes
    if (new RegExp(`\\b${h}`, 'i').test(stepsFold)) {
      C.push({ id: r.id, nom, ingredient_cite: label, head: h })
    }
  }
}

// — Rapport —
const out = []
const line = (s = '') => out.push(s)
line(`# Pré-scan qualité — ${recipes.length} recettes officielles`)
line('')
line(`## A. Friture / four sans température — ${A.length}`)
for (const a of A) line(`- [${a.type}] **${a.nom}** (\`${a.id}\`) — « ${a.extrait}… »`)
line('')
line(`## B. Id principal ≠ label — mismatch INTER-sous-catégories (vrais bugs probables) — ${B.length}`)
for (const b of B) line(`- **${b.nom}** (\`${b.id}\`) — slot « ${b.slot} » → principal \`${b.principal}\` (${b.principalLabel}, *${b.principalSubcat}*) mais le label matche \`${b.altMatchee}\` (${b.altLabel}, *${b.altSubcat}*)`)
line('')
line(`## C. Ingrédient cité en étape, absent de la liste — ${C.length} (BASSE CONFIANCE, bruyant)`)
const cByRecipe = {}
for (const c of C) (cByRecipe[c.nom] ??= []).push(c.ingredient_cite)
for (const [nom, items] of Object.entries(cByRecipe).slice(0, 60)) line(`- **${nom}** : ${[...new Set(items)].join(', ')}`)

const reportPath = join(root, 'tmp-audit-recipes-quality.md')
writeFileSync(reportPath, out.join('\n'))
console.log(`A (temp manquante): ${A.length} | B (id≠label): ${B.length} | C (étape↔liste, bruyant): ${C.length}`)
console.log(`Rapport complet → ${reportPath}`)
