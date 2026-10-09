// Optimisation des images Supabase Storage (perf — audit Lighthouse 2026-06-22).
//
// Les illustrations d'ingrédients/recettes sont des WebP pleine résolution
// (~100-200 KiB) affichées en petit (24-96px pour les icônes, plus grand pour
// les photos recette). On sert des VIGNETTES pré-générées (sous-dossier `thumb/`
// du même bucket, ~14-33 KiB) via l'endpoint OBJET.
//
// ⚠️ On N'UTILISE PLUS l'endpoint de transformation à la volée (render/image) :
// le plan Pro n'inclut que 100 « origin images » transformées/mois, or le
// catalogue compte ~743 images → dépassement structurel chaque cycle. Les
// vignettes sont produites HORS LIGNE par `scripts/generate-image-thumbnails.mjs`
// (sharp) → 0 transformation Supabase.
//
// Les URLs non-Supabase (Twemoji, Fluent Emoji, externes), nulles, ou hors des
// buckets catalogue sont renvoyées telles quelles. Si une vignette manque, les
// composants (emoji.jsx / food-icon.jsx) retombent sur l'emoji via onError.

const OBJECT_MARKER = '/storage/v1/object/public/'
const THUMB_PREFIX = 'thumb/'
const THUMB_BUCKETS = ['ingredient-icons', 'recipe-photos']

// `size` conservé pour compat des call-sites (ignoré : une seule vignette/image).
export function optimizeStorageImage(url) {
  if (!url || typeof url !== 'string') return url
  const i = url.indexOf(OBJECT_MARKER)
  if (i === -1) return url
  const start = i + OBJECT_MARKER.length
  const after = url.slice(start) // "<bucket>/<path>"
  const slash = after.indexOf('/')
  if (slash === -1) return url
  const bucket = after.slice(0, slash)
  const rest = after.slice(slash + 1)
  if (!THUMB_BUCKETS.includes(bucket)) return url
  if (rest.startsWith(THUMB_PREFIX)) return url // déjà une vignette
  return url.slice(0, start) + bucket + '/' + THUMB_PREFIX + rest
}
