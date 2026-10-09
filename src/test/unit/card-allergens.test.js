import { describe, it, expect } from 'vitest'
import { deriveRecipeAllergens, pickCardAllergens } from '@shared/lib/recipes/card-allergens'

// ingredientsById = Map id → { allergens }
function mapOf(obj) {
  return new Map(Object.entries(obj))
}

describe('deriveRecipeAllergens', () => {
  it('unionne le champ stocké avec les allergènes des ingrédients', () => {
    const recipe = {
      allergens: ['gluten'],
      ingredients: [
        { ids: ['fr-mozzarella'] },          // milk via ingrédient
        { ids: ['vg-tomate'] },              // rien
      ],
    }
    const ing = mapOf({
      'fr-mozzarella': { allergens: ['milk'] },
      'vg-tomate': { allergens: [] },
    })
    expect(deriveRecipeAllergens(recipe, ing)).toEqual(['gluten', 'milk'])
  })

  it('couvre TOUS les substituts d\'un slot (union des alternatives)', () => {
    const recipe = {
      allergens: [],
      ingredients: [{ ids: ['gp-pates', 'gp-gnocchi'] }], // gnocchi ajoute eggs
    }
    const ing = mapOf({
      'gp-pates': { allergens: ['gluten'] },
      'gp-gnocchi': { allergens: ['gluten', 'eggs'] },
    })
    expect(deriveRecipeAllergens(recipe, ing)).toEqual(['eggs', 'gluten'])
  })

  it('dédoublonne et trie', () => {
    const recipe = { allergens: ['milk'], ingredients: [{ ids: ['x'] }] }
    const ing = mapOf({ x: { allergens: ['milk'] } })
    expect(deriveRecipeAllergens(recipe, ing)).toEqual(['milk'])
  })
})

describe('deriveRecipeAllergens — filet de sécurité sous-recettes', () => {
  it('unionne les allergènes de la sous-recette référencée si recipesById est fourni', () => {
    const recipe = {
      allergens: [],
      ingredients: {
        groups: [{ name: null, items: [{ id: 'vg-tomate' }] }],
        sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
      },
    }
    const bechamel = { allergens: [], ingredients: [{ ids: ['fr-lait'] }] }
    const ing = mapOf({ 'vg-tomate': { allergens: [] }, 'fr-lait': { allergens: ['milk'] } })
    const recipesById = mapOf({ 'bechamel-maison': bechamel })
    expect(deriveRecipeAllergens(recipe, ing, recipesById)).toEqual(['milk'])
  })

  it('sans recipesById, ignore les sous-recettes (comportement inchangé, rétrocompatible)', () => {
    const recipe = {
      allergens: [],
      ingredients: {
        groups: [{ name: null, items: [{ id: 'vg-tomate' }] }],
        sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
      },
    }
    const ing = mapOf({ 'vg-tomate': { allergens: [] } })
    expect(deriveRecipeAllergens(recipe, ing)).toEqual([])
  })

  it('ne casse pas si le recipe_id référencé est introuvable dans recipesById', () => {
    const recipe = { allergens: ['gluten'], ingredients: { groups: [], sub_recipes: [{ recipe_id: 'inconnu', scale: 1 }] } }
    expect(deriveRecipeAllergens(recipe, mapOf({}), mapOf({}))).toEqual(['gluten'])
  })
})

describe('pickCardAllergens — sécurité : allergène matché jamais masqué', () => {
  it('place les allergènes matchés (profil) en tête', () => {
    const r = pickCardAllergens(['eggs', 'gluten', 'milk'], ['milk'], 3)
    expect(r.visible[0]).toBe('milk')
  })

  it('garde un allergène matché VISIBLE même au-delà du cap (position 4+)', () => {
    // 4 allergènes, cap 3, l'allergène du user (sesame) est le dernier alphabétiquement
    const all = ['celery', 'gluten', 'milk', 'sesame']
    const r = pickCardAllergens(all, ['sesame'], 3)
    expect(r.visible).toContain('sesame')      // jamais masqué
    expect(r.visible[0]).toBe('sesame')        // et en tête
  })

  it('complète avec les non-matchés jusqu\'au cap', () => {
    const r = pickCardAllergens(['celery', 'gluten', 'milk', 'sesame'], ['sesame'], 3)
    // sesame (matché) + 2 autres = 3 visibles, 1 en overflow
    expect(r.visible.length).toBe(3)
    expect(r.overflow).toBe(1)
  })

  it('montre TOUS les matchés même s\'ils dépassent le cap', () => {
    const r = pickCardAllergens(['eggs', 'gluten', 'milk', 'nuts'], ['eggs', 'gluten', 'milk', 'nuts'], 3)
    expect(r.visible.length).toBe(4)   // cap relâché pour ne masquer aucun matché
    expect(r.overflow).toBe(0)
  })

  it('sans préférences : comportement cap simple', () => {
    const r = pickCardAllergens(['celery', 'gluten', 'milk', 'sesame'], [], 3)
    expect(r.visible).toEqual(['celery', 'gluten', 'milk'])
    expect(r.overflow).toBe(1)
  })
})
