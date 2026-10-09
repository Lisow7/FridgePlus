import { AISLE_ORDER, AISLE_LABELS, AISLE_EMOJI } from './cart-helpers'

// Liste de courses regroupée par RAYON de supermarché (parcours logique en
// magasin), pas par recette. `shareRows` porte déjà `aisle` par ligne
// (cf. shopping-phase). Partagé par la copie, le partage natif et l'impression.
export function groupShareRowsByAisle(shareRows, lang) {
  const labels = AISLE_LABELS[lang] ?? AISLE_LABELS.fr
  const byAisle = new Map()
  for (const r of shareRows) {
    const a = r.aisle ?? 'other'
    if (!byAisle.has(a)) byAisle.set(a, [])
    byAisle.get(a).push(r)
  }
  return AISLE_ORDER
    .filter(a => byAisle.has(a))
    .map(a => ({ aisle: a, label: labels[a] ?? a, emoji: AISLE_EMOJI[a] ?? '📦', rows: byAisle.get(a) }))
}

export function formatShareQty(r) {
  return r.amount && r.unit ? `${r.amount} ${r.unit}` : ''
}
