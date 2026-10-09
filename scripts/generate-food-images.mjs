#!/usr/bin/env node
// CLI — npm run images:generate -- --type=<type> [...options]
// Icons Overhaul Phase 2.
//
// Génère via OpenAI GPT Image API + upload vers Supabase Storage + UPDATE col image_url.
//
// Usage :
//   npm run images:generate -- --type=ingredients --limit=5 --dry-run     # test prompts
//   npm run images:generate -- --type=ingredients --ids=fr-tomate,fr-basilic  # cherry-pick
//   npm run images:generate -- --type=recipes                              # batch 411 sans photo (~$8 en mini/medium)
//   npm run images:generate -- --type=recipes --quality=high               # idem en high (~$25)
// L'estimation exacte s'affiche AVANT le premier appel — la lire, toujours.
//
// Args :
//   --type=ingredients|recipes|fridge   (REQUIRED)
//   --ids=<csv>                         Cherry-pick IDs (default: tous)
//   --limit=<n>                         Test mini, stoppe après N
//   --dry-run                           Affiche les prompts sans appeler l'API (zero coût)
//   --force                             Re-génère même si image_url déjà set
//   --model=<m>                         Défaut : gpt-image-1-mini (cf. image-generation-config.mjs)
//   --quality=low|medium|high           Défaut : medium — 'auto' est REFUSÉ (facture 82,57 $)
//
// Prérequis env (.env.local) :
//   SUPABASE_URL (ou VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  (admin bypass RLS, jamais commiter)
//   OPENAI_API_KEY             (https://platform.openai.com/api-keys)

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { parseArgs, buildPrompt } from './lib/image-prompts.mjs'
import { resolveGenerationConfig } from './lib/image-generation-config.mjs'

export { parseArgs, buildPrompt }
// sharp importé dynamiquement dans main() pour éviter conflit jsdom dans les tests

// ─── Config ──────────────────────────────────────────────────────────────────

// Modèle, qualité et coût estimé vivent dans ./lib/image-generation-config.mjs
// (testé par image-generation-config.test.js). Migration 2026-08-26 :
// gpt-image-1 est déprécié par OpenAI au 23/10/2026, défaut = gpt-image-1-mini.
// L'historique de la facture de 82,57 $ (quality `auto`) y est documenté aussi.
const SIZE_INGREDIENT = '1024x1024'  // GPT Image min size
// 1536×1024 depuis la décision du 2026-08-26 (chantier-photos-recettes.md §5) :
// au-dessus des 1200 px recommandés par Google, et au bon ratio pour un aperçu
// de partage. Le catalogue devient MIXTE (les 104 anciennes restent carrées) —
// c'est assumé : `npm run prerender:data` MESURE désormais les dimensions
// réelles de chaque image et le pré-rendu les déclare par recette
// (`dimsImageRecette`). ⚠️ Après un batch : relancer `npm run prerender:data`.
const SIZE_RECIPE = '1536x1024'

const BUCKET_INGREDIENTS = 'ingredient-icons'
const BUCKET_RECIPES = 'recipe-photos'
// L'app ne sert JAMAIS les originaux dans les listes : elle sert les vignettes
// pré-générées de `thumb/<fichier>` (cf. optimize-storage-image.js — quota de
// transformation Supabase dépassé sinon). Une image SANS vignette retombe sur
// l'emoji après un 404 ; une vignette PÉRIMÉE affiche l'ancienne image en
// silence. D'où la règle, apprise le 2026-08-27 (latence du panneau recettes +
// pita-cookie survivant en 36 px) : la vignette se crée AU MOMENT de l'upload,
// jamais dans une étape manuelle séparée qu'on finit par oublier.
// Dimensions alignées sur generate-image-thumbnails.mjs (rattrapage/--force) :
// 192px = 96px CSS × 2, le plus grand usage réel en app (mesuré 2026-08-27).
const THUMB_DIM = { [BUCKET_INGREDIENTS]: 192, [BUCKET_RECIPES]: 192 }

// ─── Helpers (prompts dans ./lib/image-prompts.mjs) ──────────────────────────

async function fetchItems(supabase, type) {
  if (type === 'ingredients') {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, labels, image_url')
      .order('id')
    if (error) throw error
    return data
  }
  if (type === 'recipes') {
    const { data, error } = await supabase
      .from('recipes_unified')
      .select('id, name, image_url')
      .eq('origin', 'official')
      .is('deleted_at', null)
      .order('id')
    if (error) throw error
    return data
  }
  if (type === 'fridge') {
    // fridge_layouts.structure jsonb (FR) = { fridge: [...], pantry: [...] }
    // Chaque section contient un array de compartiments {id, label, emoji, subcategories[]}.
    const { data, error } = await supabase.from('fridge_layouts').select('structure').eq('language', 'fr').maybeSingle()
    if (error) throw error
    const struct = data?.structure ?? {}
    const items = []
    const seen = new Set()
    const pushUnique = (id, label, label_en) => {
      if (seen.has(id)) return
      seen.add(id)
      items.push({ id, label, label_en, image_url: null })
    }
    for (const section of ['fridge', 'pantry']) {
      const compartments = Array.isArray(struct[section]) ? struct[section] : []
      for (const comp of compartments) {
        pushUnique(`fridge-${comp.id}`, comp.label, comp.id)
        for (const sub of comp.subcategories ?? []) {
          pushUnique(`fridge-${sub.id}`, sub.label, sub.id)
        }
      }
    }
    return items
  }
  throw new Error(`Unknown type: ${type}`)
}

async function generateImage(openai, prompt, size, { model, quality }, transparent = false) {
  // 🔴 Corrigé le 2026-08-15 : cette fonction passait `SIZE_INGREDIENT` EN DUR,
  // pour tous les types. `SIZE_RECIPE` était déclaré et n'était JAMAIS lu.
  // Sans conséquence visible tant que les deux valaient `1024x1024` — mais
  // changer `SIZE_RECIPE` n'aurait rien fait, et on aurait payé un format qu'on
  // ne recevait pas. Une constante qui décrit une intention que le code
  // n'applique pas est pire qu'une constante absente.
  //
  // `quality` est désormais EXPLICITE. Sans ce paramètre, OpenAI applique
  // `auto`, qui monte fréquemment en `high` sur une photo culinaire : c'est
  // l'origine documentée de la facture de 82,57 $ (cf. en-tête du fichier).
  // gpt-image-1* retourne toujours b64_json par défaut, response_format n'est pas accepté
  //
  // 🔴 `background: 'transparent'` doit être un PARAMÈTRE API, jamais un espoir
  // de prompt : découvert le 2026-08-26 quand gpt-image-2 a rendu un fond
  // DAMIER INCRUSTÉ (aucun canal alpha) là où gpt-image-1/mini obéissaient au
  // prompt. Vérifié aux pixels (sharp : hasAlpha=false, coins opaques).
  const result = await openai.images.generate({
    model,
    prompt,
    n: 1,
    size,
    quality,
    ...(transparent && { background: 'transparent' }),
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('No image returned')
  return Buffer.from(b64, 'base64')
}

async function uploadToStorage(supabase, bucket, filename, buffer, contentType = 'image/png') {
  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType, upsert: true })
  if (uploadErr) throw uploadErr
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename)
  return data.publicUrl
}

async function updateImageUrl(supabase, type, id, publicUrl) {
  if (type === 'ingredients') {
    return supabase.from('ingredients').update({ image_url: publicUrl }).eq('id', id)
  }
  if (type === 'recipes') {
    return supabase.from('recipes_unified').update({ image_url: publicUrl }).eq('id', id)
  }
  // fridge → l'image_url des compartments est dans le jsonb structure → handled séparément (TODO Phase 6)
  return { error: null }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv)
  const type = args.type
  if (!type || !['ingredients', 'recipes', 'fridge'].includes(type)) {
    console.error('Usage: npm run images:generate -- --type=<ingredients|recipes|fridge> [--ids=csv] [--limit=N] [--dry-run] [--force]')
    process.exit(1)
  }

  const limit = args.limit ? Number(args.limit) : null
  const cherryIds = args.ids ? new Set(args.ids.split(',').map(s => s.trim())) : null
  const dryRun = !!args['dry-run']
  const force = !!args.force
  // Valide modèle + qualité et fixe le coût estimé — throw sur valeur inconnue
  // (dont `auto`), AVANT tout appel réseau.
  const genConfig = resolveGenerationConfig(args)
  if (genConfig.deprecationWarning) console.warn(genConfig.deprecationWarning)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Required env: SUPABASE_URL (ou VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!dryRun && !process.env.OPENAI_API_KEY) {
    console.error('Required env: OPENAI_API_KEY (https://platform.openai.com/api-keys) — ou utilise --dry-run')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  const openai = dryRun ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const bucket = type === 'ingredients' ? BUCKET_INGREDIENTS
    : type === 'recipes' ? BUCKET_RECIPES
    : BUCKET_INGREDIENTS  // fridge → ingredients bucket pour simplicité

  console.log(`→ Fetching ${type} from BDD...`)
  let items = await fetchItems(supabase, type)
  console.log(`  ${items.length} items récupérés`)

  // Filtre cherry-pick
  if (cherryIds) {
    items = items.filter(i => cherryIds.has(i.id))
    console.log(`  ${items.length} après filtrage --ids`)
  }

  // Filtre déjà set sauf --force
  if (!force) {
    const beforeLen = items.length
    items = items.filter(i => !i.image_url)
    if (beforeLen !== items.length) {
      console.log(`  ${beforeLen - items.length} items déjà avec image_url (skip, utilise --force pour re-gen)`)
    }
  }

  if (limit) items = items.slice(0, limit)
  if (items.length === 0) {
    console.log('  Aucun item à traiter. Bye.')
    return
  }

  const costPerItem = genConfig.costPerImage
  console.log(`\n→ ${dryRun ? '🔍 DRY-RUN' : '🎨 Génération'} sur ${items.length} items`)
  console.log(`   modèle ${genConfig.model} · qualité ${genConfig.quality} · taille ${type === 'recipes' ? SIZE_RECIPE : SIZE_INGREDIENT}`)
  console.log(`   ~$${(items.length * costPerItem).toFixed(2)} estimé (tarifs relevés le 2026-08-26, à revérifier)\n`)

  let success = 0
  let errors = 0
  let cumulCost = 0
  for (const [idx, item] of items.entries()) {
    const prompt = buildPrompt(type, item)
    const label = item.labels?.fr ?? item.name?.fr ?? item.label ?? item.id
    const progress = `[${idx + 1}/${items.length}]`

    if (dryRun) {
      console.log(`${progress} ${item.id} (${label})`)
      console.log(`         prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`)
      continue
    }

    try {
      // Les ICÔNES (ingrédients, compartiments) exigent la vraie transparence ;
      // les photos de recettes n'ont pas d'alpha.
      const pngBuffer = await generateImage(openai, prompt, type === 'recipes' ? SIZE_RECIPE : SIZE_INGREDIENT, genConfig, type !== 'recipes')
      // PNG OpenAI ≈ 2-4 MB → WebP quality 85 ≈ 80-200 KB (perf user + bucket fit)
      const { default: sharp } = await import('sharp')
      const webpBuffer = await sharp(pngBuffer).webp({ quality: 85 }).toBuffer()
      // Sanitize filename : Supabase Storage rejette les caractères non-ASCII dans les keys.
      // Ex : gp-croûtons → gp-croutons. L'image_url en BDD pointe vers le filename sanitizé,
      // mais l'item.id en BDD reste avec son caractère original.
      const sanitizedId = item.id.normalize('NFD').replace(/[̀-ͯ]/g, '')
      const filename = `${sanitizedId}.webp`
      const publicUrl = await uploadToStorage(supabase, bucket, filename, webpBuffer, 'image/webp')
      // La vignette part avec l'original (upsert : écrase une périmée).
      const thumbBuffer = await sharp(webpBuffer)
        .resize(THUMB_DIM[bucket], THUMB_DIM[bucket], { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      await uploadToStorage(supabase, bucket, `thumb/${filename}`, thumbBuffer, 'image/webp')
      const { error: updErr } = await updateImageUrl(supabase, type, item.id, publicUrl)
      if (updErr) throw updErr
      cumulCost += costPerItem
      success++
      const sizeKb = (webpBuffer.length / 1024).toFixed(0)
      console.log(`${progress} ✓ ${item.id} (${label}) → ${publicUrl} [${sizeKb} KB]`)
      console.log(`         💰 cumul $${cumulCost.toFixed(2)}`)
    } catch (err) {
      errors++
      console.error(`${progress} ✗ ${item.id} (${label}): ${err.message}`)
    }
  }

  console.log(`\n✓ Done. ${success} succès, ${errors} erreurs, $${cumulCost.toFixed(2)} dépensé.`)
}

// Auto-run sauf si import (tests)
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('generate-food-images.mjs')) {
  main().catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}
