import { describe, it, expect } from 'vitest'
import { parseIsoDuration, mapJsonLdRecipe } from '@shared/lib/recipes/jsonld-recipe-mapper'

describe('parseIsoDuration — ISO 8601 → minutes', () => {
  it.each([
    ['PT30M', 30],
    ['PT1H', 60],
    ['PT1H30M', 90],
    ['PT2H15M', 135],
    ['PT0S', 0],
  ])('%s → %i', (iso, min) => expect(parseIsoDuration(iso)).toBe(min))

  it('vide / invalide → null', () => {
    expect(parseIsoDuration('')).toBeNull()
    expect(parseIsoDuration(null)).toBeNull()
    expect(parseIsoDuration('abc')).toBeNull()
  })
})

describe('mapJsonLdRecipe — schema.org/Recipe → brouillon', () => {
  const RECIPE = {
    '@type': 'Recipe',
    name: 'Curry de lentilles',
    image: ['https://ex.com/curry.jpg'],
    recipeYield: '4 portions',
    totalTime: 'PT30M',
    recipeIngredient: ['2 oignons', '200 g de lentilles corail', '1 boîte de lait de coco'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Émincer les oignons.' },
      { '@type': 'HowToStep', text: 'Ajouter lentilles et lait de coco, mijoter.' },
    ],
  }

  it('extrait nom, image, portions, temps', () => {
    const d = mapJsonLdRecipe(RECIPE, { lang: 'fr' })
    expect(d.name).toBe('Curry de lentilles')
    expect(d.imageUrl).toBe('https://ex.com/curry.jpg')
    expect(d.servings).toBe(4)
    expect(d.timeMin).toBe(30)
  })

  it('ingredientLines = lignes brutes (à parser ensuite)', () => {
    const d = mapJsonLdRecipe(RECIPE, { lang: 'fr' })
    expect(d.ingredientLines).toEqual(['2 oignons', '200 g de lentilles corail', '1 boîte de lait de coco'])
  })

  it('steps = objet par langue depuis recipeInstructions (HowToStep)', () => {
    const d = mapJsonLdRecipe(RECIPE, { lang: 'fr' })
    expect(d.steps).toEqual({ fr: ['Émincer les oignons.', 'Ajouter lentilles et lait de coco, mijoter.'] })
  })

  it('tolère instructions en tableau de chaînes + image objet + yield numérique', () => {
    const d = mapJsonLdRecipe({
      name: 'Test', recipeYield: 6,
      image: { '@type': 'ImageObject', url: 'https://ex.com/a.png' },
      recipeInstructions: ['Étape 1', 'Étape 2'],
      recipeIngredient: ['sel'],
    }, { lang: 'en' })
    expect(d.servings).toBe(6)
    expect(d.imageUrl).toBe('https://ex.com/a.png')
    expect(d.steps).toEqual({ en: ['Étape 1', 'Étape 2'] })
  })

  it('entrée nulle/invalide → null', () => {
    expect(mapJsonLdRecipe(null)).toBeNull()
    expect(mapJsonLdRecipe({})).toMatchObject({ name: '' })
  })
})
