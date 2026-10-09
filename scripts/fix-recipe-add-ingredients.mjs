/**
 * Niveau A — ajoute un ingrédient SUBSTANTIEL utilisé dans les étapes mais absent
 * de la liste. Ajouté en `required:false` (OPTIONNEL) → le % de correspondance
 * (qui ne compte que les ingrédients requis) reste INCHANGÉ. Les basiques
 * (huile/sel/sucre) sont volontairement exclus (décision produit).
 *
 * Sûreté : dry-run par défaut ; --apply écrit ; backup d'abord ; n'ajoute QUE si
 * l'id existe au catalogue ET n'est pas déjà un id principal de la recette.
 *
 * Usage : node scripts/fix-recipe-add-ingredients.mjs [--apply]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
function loadEnv() {
  const f = join(root, '.env.local'); if (!existsSync(f)) return {}
  const env = {}
  for (const line of readFileSync(f, 'utf-8').split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}
const env = { ...loadEnv(), ...process.env }
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// [recette, id, labelFr, labelEn, amount, unit]
const ADDS = [
  ['katsudon', 'jp-mirin', '2 c. à soupe de mirin', '2 tbsp mirin', 2, 'cs'],
  ['risotto-champignons', 'gp-bouillon-cube', '75 cl de bouillon de légumes', '750 ml vegetable stock', 75, 'cl'],
  ['sopa-azteca', 'gp-bouillon-cube', '1 L de bouillon de poulet', '1 L chicken stock', 100, 'cl'],
  ['cassoulet', 'gp-bouillon-cube', '50 cl de bouillon', '500 ml stock', 50, 'cl'],
  ['quiche-lorraine', 'fr-pate-brisee', '1 pâte brisée', '1 shortcrust pastry', 1, 'pcs'],
  ['lasagnes-legumes', 'fr-beurre', '30 g de beurre', '30 g butter', 30, 'g'],
  ['lasagnes-legumes', 'gp-farine', '30 g de farine', '30 g flour', 30, 'g'],
  ['blueberry-muffins', 'fr-beurre', '80 g de beurre fondu', '80 g melted butter', 80, 'g'],
  ['muffins-choco', 'gp-extrait-vanille', '1 c. à café de vanille', '1 tsp vanilla', 1, 'cc'],
  ['granola-maison', 'gp-extrait-vanille', '1 c. à café de vanille', '1 tsp vanilla', 1, 'cc'],
  ['cake-citron', 'gp-sucre-glace', '100 g de sucre glace', '100 g icing sugar', 100, 'g'],
  ['carrot-cake', 'gp-levure', '1 sachet de levure chimique', '1 sachet baking powder', 1, 'pcs'],
  ['salade-avocat-crevettes', 'sp-moutarde', '1 c. à café de moutarde', '1 tsp mustard', 1, 'cc'],
  ['salade-poulet-avocat', 'sp-moutarde', '1 c. à café de moutarde', '1 tsp mustard', 1, 'cc'],
  ['mapo-tofu', 'gp-fecule-mais', '1 c. à café de fécule', '1 tsp cornstarch', 1, 'cc'],
  ['moules-mariniere', 'sp-thym', '1 branche de thym', '1 sprig thyme', 1, 'pcs'],
  ['salade-chevre-chaud', 'fr-lardons', '100 g de lardons', '100 g lardons', 100, 'g'],
  ['salade-chevre-chaud', 'sp-moutarde', '1 c. à café de moutarde', '1 tsp mustard', 1, 'cc'],
  ['gigantes-plaki', 'fr-feta', '100 g de feta', '100 g feta', 100, 'g'],
  ['salade-cesar', 'gp-anchois', '2 anchois', '2 anchovies', 2, 'pcs'],
  ['salade-cesar', 'sp-mayonnaise', '2 c. à soupe de mayonnaise', '2 tbsp mayonnaise', 2, 'cs'],
  ['salade-cesar', 'sp-worcestershire', '1 c. à café de sauce Worcestershire', '1 tsp Worcestershire sauce', 1, 'cc'],
  ['endives-braisees', 'fr-citron', '½ citron (jus)', '½ lemon (juice)', 0.5, 'pcs'],
]

const { data: cat } = await supabase.from('ingredients').select('id')
const known = new Set(cat.map(c => c.id))

const ids = [...new Set(ADDS.map(a => a[0]))]
const { data: recipes, error } = await supabase.from('recipes_unified').select('id, ingredients').in('id', ids)
if (error) { console.error('Lecture :', error.message); process.exit(1) }
const byId = new Map(recipes.map(r => [r.id, r]))

const backup = {}
const updates = new Map()
let ok = 0, skip = 0
for (const [rid, id, lf, le, amount, unit] of ADDS) {
  const r = byId.get(rid); if (!r) { console.warn(`⚠️  ${rid} introuvable — skip`); skip++; continue }
  if (!known.has(id)) { console.warn(`⚠️  ${rid} : id catalogue « ${id} » INEXISTANT — skip`); skip++; continue }
  const ings = updates.get(rid) ?? JSON.parse(JSON.stringify(r.ingredients))
  if (ings.some(s => Array.isArray(s.ids) && s.ids[0] === id)) { console.warn(`⚠️  ${rid} : « ${id} » déjà présent — skip`); skip++; continue }
  if (!backup[rid]) backup[rid] = JSON.parse(JSON.stringify(r.ingredients))
  ings.push({ ids: [id], qty: { amount, unit }, labels: { fr: lf, en: le }, required: false })
  updates.set(rid, ings)
  console.log(`  ✎ ${rid} : + « ${lf} » (${id}, optionnel)`)
  ok++
}
console.log(`\n${ok} ajouts sur ${updates.size} recettes · ${skip} sautés · mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`)
if (!APPLY) { console.log('\n(dry-run — relance avec --apply)'); process.exit(0) }

const dir = join(root, 'backups'); if (!existsSync(dir)) mkdirSync(dir)
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const bpath = join(dir, `recipes-addingredients-backup-${stamp}.json`)
writeFileSync(bpath, JSON.stringify(backup, null, 2)); console.log(`\nBackup → ${bpath}`)
for (const [rid, ings] of updates) {
  const { error: e } = await supabase.from('recipes_unified').update({ ingredients: ings }).eq('id', rid)
  if (e) console.error(`  ✗ ${rid} : ${e.message}`); else console.log(`  ✓ ${rid}`)
}
console.log('\nÉcriture terminée.')
