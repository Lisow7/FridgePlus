// Combien d'aliments d'une sous-catégorie sont au frigo.
//
// La formule était recopiée 13 fois dans les composants du frigo (audit du
// 2026-10-04, ARCH-07) : `fridge-interiors`, `fridge-side-by-side`,
// `fridge-standard`, `pantry-shelf`. `catalogue` est celui de `useIngredients()`
// (sous-catégorie → aliments), `stock` l'ensemble des identifiants au frigo.
export function compterEnStock(catalogue, sousCategorie, stock) {
  return (catalogue[sousCategorie] ?? []).filter((aliment) => stock.has(aliment.id)).length
}
