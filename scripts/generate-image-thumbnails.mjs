/**
 * Génère des VIGNETTES pré-dimensionnées pour les images du catalogue
 * (buckets Storage `ingredient-icons` et `recipe-photos`) et les upload dans un
 * sous-dossier `thumb/` du même bucket.
 *
 * POURQUOI : les originaux sont des WebP ~200 Ko affichés en 24-96px. On les
 * servait via l'endpoint de TRANSFORMATION à la volée de Supabase (render/image),
 * mais le plan Pro n'inclut que 100 « origin images » transformées/mois → le
 * catalogue (~743 images) dépasse structurellement chaque cycle. Solution : on
 * pré-génère les vignettes (hors ligne, via sharp — ne consomme PAS le quota de
 * transformation) et on les sert via l'endpoint OBJET (0 transformation).
 *
 * Idempotent : re-exécutable, saute les vignettes déjà présentes.
 * `--force` : régénère TOUTES les vignettes (upsert) — indispensable après une
 * RÉGÉNÉRATION d'originaux, car une vignette existante mais PÉRIMÉE est pire
 * qu'une vignette absente : l'app affiche l'ancienne image en silence
 * (constaté le 2026-08-27 : le pita-cookie corrigé survivait en 36 px).
 * Non destructif : les originaux ne sont jamais modifiés.
 *
 * ⚠️ Depuis le 2026-08-27, `generate-food-images.mjs` crée la vignette AU
 * MOMENT de l'upload : ce script ne sert plus qu'au rattrapage/--force.
 *
 * Prérequis : VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.local.
 * Lancer : node scripts/generate-image-thumbnails.mjs [--force]
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
function loadEnv() {
  const f = join(root, '.env.local')
  if (!existsSync(f)) return {}
  const env = {}
  for (const line of readFileSync(f, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}
const env = { ...loadEnv(), ...process.env }
const URL = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('❌ VITE_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local')
  process.exit(1)
}

const supa = createClient(URL, KEY, { auth: { persistSession: false } })

// Taille max de vignette par bucket (WebP, contient l'image, sans agrandir).
// MESURÉ le 2026-08-27 : dans l'app, les photos de recette ne s'affichent
// JAMAIS au-dessus de 60px CSS (avatars des cartes et de l'en-tête détail) —
// le grand format ne sert qu'au SEO/partage, via l'ORIGINAL. L'ancien 640px
// décodait 11× trop de pixels par carte (contributeur aux pertes de FPS du
// panneau). 192px = 96px CSS × 2 (Retina), le plus grand usage réel.
const BUCKETS = [
  { id: 'ingredient-icons', dim: 192 },
  { id: 'recipe-photos',    dim: 192 },
]
const THUMB_PREFIX = 'thumb/'

async function listAll(bucket) {
  const out = []
  let offset = 0
  const limit = 1000
  for (;;) {
    const { data, error } = await supa.storage.from(bucket).list('', { limit, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const f of data) if (f.id && /\.webp$/i.test(f.name)) out.push(f.name)
    if (data.length < limit) break
    offset += limit
  }
  return out
}

async function existingThumbs(bucket) {
  const set = new Set()
  const { data, error } = await supa.storage.from(bucket).list(THUMB_PREFIX.replace(/\/$/, ''), { limit: 2000 })
  if (error) return set // dossier absent = aucune vignette encore
  for (const f of data ?? []) if (f.id) set.add(f.name)
  return set
}

const FORCE = process.argv.includes('--force')
let totalDone = 0, totalSkip = 0, totalErr = 0
for (const { id: bucket, dim } of BUCKETS) {
  const names = await listAll(bucket)
  const have = FORCE ? new Set() : await existingThumbs(bucket)
  console.log(`\n▶ ${bucket} : ${names.length} images (dim ${dim}px) — ${FORCE ? 'FORCE : tout régénérer' : `déjà ${have.size} vignettes`}`)
  for (const name of names) {
    if (have.has(name)) { totalSkip++; continue }
    try {
      const { data, error } = await supa.storage.from(bucket).download(name)
      if (error) throw error
      const input = Buffer.from(await data.arrayBuffer())
      const thumb = await sharp(input)
        .resize(dim, dim, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      const { error: upErr } = await supa.storage.from(bucket)
        .upload(THUMB_PREFIX + name, thumb, { contentType: 'image/webp', upsert: true })
      if (upErr) throw upErr
      totalDone++
      if (totalDone % 50 === 0) console.log(`  … ${totalDone} vignettes générées`)
    } catch (e) {
      totalErr++
      console.error(`  ✗ ${bucket}/${name} : ${e.message}`)
    }
  }
}
console.log(`\n✅ Terminé — générées: ${totalDone}, sautées (déjà présentes): ${totalSkip}, erreurs: ${totalErr}`)
process.exit(totalErr > 0 ? 1 : 0)
