import { useState } from 'react'
import { FOOD_ICONS } from '@shared/static/icon-map'
import { optimizeStorageImage } from '@shared/lib/images/optimize-storage-image'

// Icons Overhaul P5 (2026-05-19) — Convention naming pour images custom frigo.
// Les 30 compartiments/sous-cats du frigo ont été générés via OpenAI gpt-image-1
// et uploadés sur Supabase Storage avec convention `fridge-{id}.webp`.
//
// Cascade de fallback du composant <FoodIcon> :
//   1. Image custom Supabase Storage (`/ingredient-icons/fridge-{id}.webp`)
//   2. Icône Lucide via FOOD_ICONS map (fallback historique)
//   3. null (si id totalement inconnu)
//
// La cascade est gracieuse : si l'image custom 404 (CORS, network, fichier
// pas encore généré), onError bascule sur l'icône Lucide. Rétro-compat 100%.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const FRIDGE_ICONS_CDN = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/ingredient-icons`
  : null

function getFridgeImageUrl(id) {
  if (!FRIDGE_ICONS_CDN || !id) return null
  return `${FRIDGE_ICONS_CDN}/fridge-${id}.webp`
}

export default function FoodIcon({ id, size = 24, color = 'currentColor', style }) {
  const [imgFailed, setImgFailed] = useState(false)
  // Perf : on demande une variante redimensionnée (render/image) à la taille
  // d'affichage plutôt que le WebP pleine résolution (~200 KiB). Cf. audit
  // Lighthouse 2026-06-22.
  const imageUrl = !imgFailed ? optimizeStorageImage(getFridgeImageUrl(id), size) : null

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        draggable={false}
        aria-hidden="true"
        onError={() => setImgFailed(true)}
        style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain', ...style }}
      />
    )
  }

  // Fallback : icône Lucide historique
  const Icon = FOOD_ICONS[id]
  if (!Icon) return null
  return <Icon size={size} color={color} style={style} />
}
