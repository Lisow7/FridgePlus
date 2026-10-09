import { describe, it, expect } from 'vitest'
import { INGREDIENTS } from '@shared/static/ingredients'
import { RECIPES } from '@shared/static/recipes'
import { FRIDGE_LAYOUTS } from '@shared/static/fridge-layouts'

// Sprint 7 PR S7.b — Réduction à FR + EN.
const LANGS = ['fr', 'en']
const ID_PREFIXES = ['frz-', 'fr-', 'vg-', 'gp-', 'sp-', 'bk-', 'jp-']

// Aplatit toutes les catégories en une liste d'ingrédients
const allIngredients = Object.values(INGREDIENTS).flat()

// ─── INGREDIENTS ─────────────────────────────────────────────────────────────
describe('INGREDIENTS — intégrité de la structure', () => {
  it('au moins 50 ingrédients au total', () => {
    expect(allIngredients.length).toBeGreaterThanOrEqual(50)
  })

  it('chaque ingrédient a un id unique par catégorie', () => {
    for (const [category, items] of Object.entries(INGREDIENTS)) {
      const ids = items.map(i => i.id)
      const unique = new Set(ids)
      expect(unique.size, `Doublons dans la catégorie ${category}`).toBe(ids.length)
    }
  })

  it('chaque ingrédient a un id avec préfixe valide', () => {
    for (const ing of allIngredients) {
      const valid = ID_PREFIXES.some(p => ing.id.startsWith(p))
      expect(valid, `id invalide : ${ing.id}`).toBe(true)
    }
  })

  it('chaque ingrédient a un label dans toutes les langues supportées', () => {
    for (const ing of allIngredients) {
      for (const lang of LANGS) {
        expect(ing.labels[lang], `${ing.id} manque label ${lang}`).toBeTruthy()
      }
    }
  })

  it('chaque label est une chaîne non vide', () => {
    for (const ing of allIngredients) {
      for (const lang of LANGS) {
        expect(typeof ing.labels[lang]).toBe('string')
        expect(ing.labels[lang].trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('chaque ingrédient a un emoji non vide', () => {
    for (const ing of allIngredients) {
      expect(ing.emoji, `${ing.id} n'a pas d'emoji`).toBeTruthy()
      expect(ing.emoji.trim().length).toBeGreaterThan(0)
    }
  })

  it('aucun id ne contient d\'espace', () => {
    for (const ing of allIngredients) {
      expect(ing.id, `id avec espace : ${ing.id}`).not.toContain(' ')
    }
  })

  it('INGREDIENTS a au moins 5 catégories', () => {
    expect(Object.keys(INGREDIENTS).length).toBeGreaterThanOrEqual(5)
  })
})

// ─── RECIPES ─────────────────────────────────────────────────────────────────
describe('RECIPES — intégrité de la structure', () => {
  it('au moins 10 recettes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(10)
  })

  it('chaque recette a un id unique', () => {
    const ids = RECIPES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque recette a les champs obligatoires', () => {
    const required = ['id', 'emoji', 'time', 'difficulty', 'type', 'servings', 'ingredients']
    for (const recipe of RECIPES) {
      for (const field of required) {
        expect(recipe[field], `recette ${recipe.id} manque ${field}`).toBeDefined()
      }
    }
  })

  it('chaque recette a au moins un ingrédient', () => {
    for (const recipe of RECIPES) {
      expect(recipe.ingredients.length, `${recipe.id} n'a pas d'ingrédients`).toBeGreaterThan(0)
    }
  })

  it('chaque recette a au moins un ingrédient requis', () => {
    for (const recipe of RECIPES) {
      const hasRequired = recipe.ingredients.some(i => i.required)
      expect(hasRequired, `${recipe.id} n'a aucun ingrédient required`).toBe(true)
    }
  })

  it('chaque slot d\'ingrédient a un tableau ids non vide', () => {
    for (const recipe of RECIPES) {
      for (const slot of recipe.ingredients) {
        expect(Array.isArray(slot.ids), `${recipe.id} — ids pas un tableau`).toBe(true)
        expect(slot.ids.length, `${recipe.id} — ids vide`).toBeGreaterThan(0)
      }
    }
  })

  it('chaque slot a un booléen required', () => {
    for (const recipe of RECIPES) {
      for (const slot of recipe.ingredients) {
        expect(typeof slot.required, `${recipe.id} — required non booléen`).toBe('boolean')
      }
    }
  })

  it('chaque slot a un label dans toutes les langues supportées', () => {
    for (const recipe of RECIPES) {
      for (const slot of recipe.ingredients) {
        for (const lang of LANGS) {
          expect(slot.labels?.[lang], `${recipe.id} — slot sans label ${lang}`).toBeTruthy()
        }
      }
    }
  })

  it('servings est un entier entre 1 et 12', () => {
    for (const recipe of RECIPES) {
      expect(Number.isInteger(recipe.servings)).toBe(true)
      expect(recipe.servings).toBeGreaterThanOrEqual(1)
      expect(recipe.servings).toBeLessThanOrEqual(12)
    }
  })

  it('emoji est une chaîne non vide', () => {
    for (const recipe of RECIPES) {
      expect(typeof recipe.emoji).toBe('string')
      expect(recipe.emoji.trim().length).toBeGreaterThan(0)
    }
  })
})

// ─── FRIDGE_LAYOUTS ───────────────────────────────────────────────────────────
describe('FRIDGE_LAYOUTS — intégrité de la structure', () => {
  it('toutes les langues supportées ont un layout', () => {
    for (const lang of LANGS) {
      expect(FRIDGE_LAYOUTS[lang], `Layout manquant pour ${lang}`).toBeDefined()
    }
  })

  it('chaque layout a un type valide', () => {
    const validTypes = ['top-freezer', 'side-by-side', 'bottom-freezer', 'french-door', 'mini-fridge', 'multi-door']
    for (const lang of LANGS) {
      expect(validTypes).toContain(FRIDGE_LAYOUTS[lang].type)
    }
  })

  it('chaque layout a les labels UI requis', () => {
    const requiredLabels = ['fridgeLabel', 'pantryLabel', 'recipesLabel', 'resetLabel']
    for (const lang of LANGS) {
      for (const label of requiredLabels) {
        expect(FRIDGE_LAYOUTS[lang][label], `${lang} manque ${label}`).toBeTruthy()
      }
    }
  })

  it('chaque layout a au moins un compartiment fridge', () => {
    for (const lang of LANGS) {
      expect(FRIDGE_LAYOUTS[lang].fridge.length).toBeGreaterThan(0)
    }
  })

  it('chaque compartiment a des sous-catégories', () => {
    for (const lang of LANGS) {
      for (const comp of FRIDGE_LAYOUTS[lang].fridge) {
        expect(comp.subcategories.length, `${lang}/${comp.id} sans sous-catégories`).toBeGreaterThan(0)
      }
    }
  })

  it('chaque layout a un pantry non vide', () => {
    for (const lang of LANGS) {
      expect(FRIDGE_LAYOUTS[lang].pantry.length).toBeGreaterThan(0)
    }
  })

  it('les ids de compartiments sont uniques par layout', () => {
    for (const lang of LANGS) {
      const ids = FRIDGE_LAYOUTS[lang].fridge.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
