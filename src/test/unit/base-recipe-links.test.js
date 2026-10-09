import { describe, it, expect } from 'vitest'
import { BASE_RECIPE_LINKS, resolveBaseRecipeLink } from '@shared/lib/recipes/base-recipe-links'

describe('BASE_RECIPE_LINKS (invariants)', () => {
  it('ids uniques, recipeIds non vide, match.fr non vide', () => {
    const ids = BASE_RECIPE_LINKS.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of BASE_RECIPE_LINKS) {
      expect(Array.isArray(e.recipeIds)).toBe(true)
      expect(e.recipeIds.length).toBeGreaterThan(0)
      expect(e.match.fr.length).toBeGreaterThan(0)
    }
  })

  it('contient l\'entrée houmous pointant vers la recette existante "houmous"', () => {
    const houmous = BASE_RECIPE_LINKS.find(e => e.id === 'houmous')
    expect(houmous.recipeIds).toEqual(['houmous'])
  })
})

describe('resolveBaseRecipeLink', () => {
  const entry = { id: 'bechamel', recipeIds: ['bechamel-maison'], match: { fr: ['béchamel'], en: ['béchamel'] } }

  it('résout vers la recette si elle existe et n\'est pas la recette courante', () => {
    const recipesById = new Map([['bechamel-maison', { id: 'bechamel-maison' }]])
    expect(resolveBaseRecipeLink(entry, recipesById, 'lasagnes')).toEqual(['bechamel-maison'])
  })

  it('exclut la recette si elle n\'existe pas encore', () => {
    const recipesById = new Map()
    expect(resolveBaseRecipeLink(entry, recipesById, 'lasagnes')).toEqual([])
  })

  it('garde-fou auto-lien : exclut la recette si c\'est la recette courante', () => {
    const recipesById = new Map([['bechamel-maison', { id: 'bechamel-maison' }]])
    expect(resolveBaseRecipeLink(entry, recipesById, 'bechamel-maison')).toEqual([])
  })

  it('recipesById absent → tableau vide, ne plante pas', () => {
    expect(resolveBaseRecipeLink(entry, undefined, 'lasagnes')).toEqual([])
  })

  it('plusieurs recipeIds → garde ceux qui existent et ne sont pas la recette courante', () => {
    const multi = { id: 'veloute', recipeIds: ['veloute-classique', 'veloute-inexistant'], match: { fr: ['velouté'], en: ['velouté'] } }
    const recipesById = new Map([['veloute-classique', { id: 'veloute-classique' }]])
    expect(resolveBaseRecipeLink(multi, recipesById, 'lasagnes')).toEqual(['veloute-classique'])
  })
})
