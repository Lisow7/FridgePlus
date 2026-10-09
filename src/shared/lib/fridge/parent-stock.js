// Un id « parent » (catégorie générique : Fromage, Bœuf, Poisson…) n'est
// jamais sélectionnable dans le frigo — c'est un en-tête de groupe, seules
// ses variantes se stockent (cf. subcategory-modal). Un parent ne doit donc
// JAMAIS figurer dans le stock. Ce helper pur repère les parents présents
// dans un itérable de stock, à partir du `groupMap` (parentId → [enfants]).
//
// Sert au garde-fou auto-réparateur (App.jsx) qui retire ces ids fantômes :
// tous les compteurs frigo redeviennent justes sans toucher chaque site.
export function parentIdsInStock(stockIds, groupMap) {
  if (!groupMap) return []
  const out = []
  for (const id of stockIds ?? []) {
    // `id` est une clé de groupMap ⟺ d'autres ingrédients le déclarent comme
    // parent (group_id) ⟺ c'est une catégorie non sélectionnable.
    if (groupMap[id]) out.push(id)
  }
  return out
}
