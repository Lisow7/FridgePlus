import { describe, it, expect } from 'vitest'
import { compterLesFiltresActifs } from '@features/recipes/lib/recipe-active-filters'

// Le badge du bouton « Filtres » (barre) et l'en-tête du tiroir comptaient les
// filtres actifs chacun de son côté. Le 07/10, le tiroir a cessé de compter un
// budget qu'il ne montre plus (audit UX-07) ; la barre, elle, le comptait
// encore — un « Filtres (1) » sans rien à retirer. Une seule fonction compte.

const repos = {
  typeSet: new Set(), difficultySet: new Set(), dietSet: new Set(), countrySet: new Set(),
  sortMode: 'match', seasonalOnly: false, healthyOnly: false, noCookOnly: false, antiWasteOnly: false,
  freezerFriendlyOnly: false, kidsFriendlyOnly: false, batchCookingOnly: false,
  minProtein: null, maxCalories: null, maxBudget: null, budgetVisible: false,
}

describe('filtres actifs : un seul compte', () => {
  it('rien d’actif : 0', () => {
    expect(compterLesFiltresActifs(repos)).toBe(0)
  })
  it('chaque réglage compte pour un, les ensembles pour leur taille', () => {
    expect(compterLesFiltresActifs({ ...repos, typeSet: new Set(['plat', 'dessert']), sortMode: 'quick', healthyOnly: true, maxCalories: 600 })).toBe(5)
  })
  it('un budget compte seulement s’il est visible', () => {
    expect(compterLesFiltresActifs({ ...repos, maxBudget: 3, budgetVisible: true })).toBe(1)
    expect(compterLesFiltresActifs({ ...repos, maxBudget: 3, budgetVisible: false })).toBe(0)
  })
})
