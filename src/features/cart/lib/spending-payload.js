// Construit le payload d'un événement dépense (« Mes dépenses » Premium)
// à partir des articles cochés au moment de « J'ai fait mes courses ».
//
// Forme attendue par recordSpendingEvent (@shared/api/spending) :
//   { total_eur, items_count, items_json: [{ id, qty, unit, unit_eur }] }
//
// Le prix utilisé est `item.price` (déjà résolu via getEmbeddedPrice à
// l'ajout au panier). Les articles sans ingredient_id sont ignorés.
export function buildSpendingPayload(checkedItems = []) {
  const items_json = checkedItems
    .map((i) => ({
      id: i.ingredient_id ?? i.id ?? null,
      qty: i.amount ?? 0,
      unit: i.unit ?? 'pcs',
      unit_eur: Number(i.price ?? 0) || 0,
    }))
    .filter((i) => i.id)
  const total_eur = Math.round(items_json.reduce((s, i) => s + i.unit_eur, 0) * 100) / 100
  return { total_eur, items_count: items_json.length, items_json }
}
