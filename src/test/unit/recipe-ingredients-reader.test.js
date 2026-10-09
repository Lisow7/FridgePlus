// Tests pour les helpers de lecture rétro-compatible des ingrédients.
// Refonte Recettes Phase 11.a — D18.
// Refonte Recettes Phase 11.b — nouveaux helpers getIngredientId/Qty/Ids/isIngredientRequired.

import { describe, it, expect } from 'vitest'
import {
  hasIngredientGroups,
  getIngredientGroups,
  getIngredientItemsFlat,
  getSubRecipes,
  pickGroupName,
  getIngredientId,
  getIngredientQty,
  isIngredientRequired,
  getIngredientIds,
} from '../../shared/lib/recipes/recipe-ingredients'

describe('hasIngredientGroups', () => {
  it('false pour format legacy (array)', () => {
    expect(hasIngredientGroups({ ingredients: [{ ids: ['gp-pates'] }] })).toBe(false)
  })

  it('true pour format enrichi (object avec groups)', () => {
    expect(hasIngredientGroups({ ingredients: { groups: [{ name: null, items: [] }] } })).toBe(true)
  })

  it('false si ingredients absent', () => {
    expect(hasIngredientGroups({})).toBe(false)
    expect(hasIngredientGroups(null)).toBe(false)
    expect(hasIngredientGroups(undefined)).toBe(false)
  })

  it('false si objet sans groups', () => {
    expect(hasIngredientGroups({ ingredients: { something_else: [] } })).toBe(false)
  })
})

describe('getIngredientGroups', () => {
  it('format legacy → wrap en 1 groupe sans nom', () => {
    const recipe = { ingredients: [{ ids: ['gp-pates'], qty: { amount: 400, unit: 'g' } }] }
    const groups = getIngredientGroups(recipe)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBeNull()
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].ids).toEqual(['gp-pates'])
  })

  it('format enrichi → retourne les groupes tels quels', () => {
    const recipe = {
      ingredients: {
        groups: [
          { name: { fr: 'Pour la pâte' }, items: [{ id: 'gp-farine', amount: 250, unit: 'g' }] },
          { name: { fr: 'Garniture' }, items: [{ id: 'gp-tomate', amount: 4, unit: 'pcs' }] },
        ],
      },
    }
    const groups = getIngredientGroups(recipe)
    expect(groups).toHaveLength(2)
    expect(groups[0].name.fr).toBe('Pour la pâte')
    expect(groups[1].items[0].id).toBe('gp-tomate')
  })

  it('items absent ou non-array → []', () => {
    const groups = getIngredientGroups({
      ingredients: { groups: [{ name: { fr: 'X' } }] },
    })
    expect(groups[0].items).toEqual([])
  })

  it('ingredients absent → []', () => {
    expect(getIngredientGroups({})).toEqual([])
    expect(getIngredientGroups(null)).toEqual([])
  })

  it('format legacy array vide → 1 groupe avec items vides', () => {
    expect(getIngredientGroups({ ingredients: [] })).toEqual([{ name: null, items: [] }])
  })
})

describe('getIngredientItemsFlat', () => {
  it('format legacy → array tel quel', () => {
    const items = [{ ids: ['gp-a'] }, { ids: ['gp-b'] }]
    expect(getIngredientItemsFlat({ ingredients: items })).toEqual(items)
  })

  it('format enrichi → concat des items de tous les groupes en ordre', () => {
    const recipe = {
      ingredients: {
        groups: [
          { name: { fr: 'G1' }, items: [{ id: 'a' }, { id: 'b' }] },
          { name: { fr: 'G2' }, items: [{ id: 'c' }] },
        ],
      },
    }
    const flat = getIngredientItemsFlat(recipe)
    expect(flat.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('vide si ingredients absent', () => {
    expect(getIngredientItemsFlat({})).toEqual([])
  })
})

describe('getSubRecipes', () => {
  it('retourne sub_recipes du format enrichi', () => {
    const recipe = {
      ingredients: {
        groups: [],
        sub_recipes: [{ recipe_id: 'bechamel', scale: 1, notes: { fr: 'préparer avant' } }],
      },
    }
    expect(getSubRecipes(recipe)).toHaveLength(1)
    expect(getSubRecipes(recipe)[0].recipe_id).toBe('bechamel')
  })

  it('[] pour format legacy', () => {
    expect(getSubRecipes({ ingredients: [{ ids: ['gp-a'] }] })).toEqual([])
  })

  it('[] si ingredients absent', () => {
    expect(getSubRecipes({})).toEqual([])
  })

  it('[] si sub_recipes absent en format enrichi', () => {
    expect(getSubRecipes({ ingredients: { groups: [] } })).toEqual([])
  })
})

describe('pickGroupName', () => {
  it('cascade lang → fr → première valeur', () => {
    const name = { fr: 'Pour la pâte', en: 'For the dough' }
    expect(pickGroupName(name, 'en')).toBe('For the dough')
    expect(pickGroupName(name, 'fr')).toBe('Pour la pâte')
    expect(pickGroupName(name, 'ja')).toBe('Pour la pâte') // fallback fr
  })

  it('fallback premier value si fr absent', () => {
    expect(pickGroupName({ en: 'For the dough' }, 'es')).toBe('For the dough')
  })

  it('passthrough string', () => {
    expect(pickGroupName('Sauce', 'fr')).toBe('Sauce')
  })

  it('null pour groupe sans nom', () => {
    expect(pickGroupName(null, 'fr')).toBeNull()
    expect(pickGroupName(undefined, 'fr')).toBeNull()
  })

  it('null pour objet vide', () => {
    expect(pickGroupName({}, 'fr')).toBeNull()
  })
})

// ─── Phase 11.b — nouveaux helpers ───────────────────────────────────────────

describe('getIngredientId', () => {
  it('retourne item.id pour le format enrichi v2', () => {
    expect(getIngredientId({ id: 'fr-poulet', amount: 200, unit: 'g' })).toBe('fr-poulet')
  })

  it('retourne item.ids[0] pour le format legacy', () => {
    expect(getIngredientId({ ids: ['frz-poulet', 'fr-poulet'], qty: { amount: 200, unit: 'g' } })).toBe('frz-poulet')
  })

  it('retourne null si item null/undefined', () => {
    expect(getIngredientId(null)).toBeNull()
    expect(getIngredientId(undefined)).toBeNull()
  })

  it('retourne null si aucun id disponible', () => {
    expect(getIngredientId({ amount: 100, unit: 'g' })).toBeNull()
    expect(getIngredientId({ ids: [] })).toBeNull()
  })
})

describe('getIngredientQty', () => {
  it('retourne {amount, unit} pour le format enrichi v2 (champs plats)', () => {
    const result = getIngredientQty({ id: 'gp-tomate', amount: 150, unit: 'g' })
    expect(result).toEqual({ amount: 150, unit: 'g' })
  })

  it('retourne item.qty pour le format legacy', () => {
    const qty = { amount: 200, unit: 'g' }
    const result = getIngredientQty({ ids: ['gp-tomate'], qty })
    expect(result).toBe(qty)
  })

  it('retourne null si item null/undefined', () => {
    expect(getIngredientQty(null)).toBeNull()
    expect(getIngredientQty(undefined)).toBeNull()
  })

  it('retourne null si aucune qty disponible', () => {
    expect(getIngredientQty({ id: 'gp-tomate' })).toBeNull()
  })

  it('gère unit null en v2 (unit optionnel)', () => {
    const result = getIngredientQty({ id: 'gp-tomate', amount: 2 })
    expect(result).toEqual({ amount: 2, unit: null })
  })
})

describe('isIngredientRequired', () => {
  it('retourne true si required=true', () => {
    expect(isIngredientRequired({ id: 'gp-tomate', required: true })).toBe(true)
  })

  it('retourne false si required=false', () => {
    expect(isIngredientRequired({ id: 'gp-tomate', required: false })).toBe(false)
  })

  it('retourne false si required absent', () => {
    expect(isIngredientRequired({ id: 'gp-tomate' })).toBe(false)
  })

  it('retourne false si item null/undefined', () => {
    expect(isIngredientRequired(null)).toBe(false)
    expect(isIngredientRequired(undefined)).toBe(false)
  })
})

describe('getIngredientIds', () => {
  it('retourne item.ids tel quel pour le format legacy', () => {
    const ids = ['frz-poulet', 'fr-poulet']
    expect(getIngredientIds({ ids })).toBe(ids)
  })

  it('retourne [item.id, ...item.alternatives] pour le format v2', () => {
    const result = getIngredientIds({ id: 'fr-poulet', alternatives: ['frz-poulet', 'gp-dinde'] })
    expect(result).toEqual(['fr-poulet', 'frz-poulet', 'gp-dinde'])
  })

  it('retourne [item.id] si pas d\'alternatives en v2', () => {
    expect(getIngredientIds({ id: 'fr-poulet' })).toEqual(['fr-poulet'])
  })

  it('retourne [] si item null/undefined', () => {
    expect(getIngredientIds(null)).toEqual([])
    expect(getIngredientIds(undefined)).toEqual([])
  })

  it('retourne [] si aucun id disponible', () => {
    expect(getIngredientIds({ amount: 100, unit: 'g' })).toEqual([])
  })
})
