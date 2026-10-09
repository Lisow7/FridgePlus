// Combien de réglages du tiroir des filtres sont actifs. Le badge du bouton
// « Filtres » (barre) et l'en-tête du tiroir comptent la MÊME chose : ils
// avaient chacun leur copie, et le 07/10 la barre comptait encore un budget que
// le tiroir ne montrait plus (audit du 2026-10-04, UX-07). Le budget ne compte
// que s'il est visible, c'est-à-dire pour qui voit les coûts.
export function compterLesFiltresActifs(f) {
  return f.typeSet.size + f.difficultySet.size + f.dietSet.size + f.countrySet.size
    + (f.sortMode !== 'match' ? 1 : 0)
    + (f.seasonalOnly ? 1 : 0)
    + (f.healthyOnly ? 1 : 0)
    + (f.noCookOnly ? 1 : 0)
    + (f.antiWasteOnly ? 1 : 0)
    + (f.freezerFriendlyOnly ? 1 : 0)
    + (f.kidsFriendlyOnly ? 1 : 0)
    + (f.batchCookingOnly ? 1 : 0)
    + (f.minProtein != null ? 1 : 0)
    + (f.maxCalories != null ? 1 : 0)
    + (f.budgetVisible && f.maxBudget != null ? 1 : 0)
}
