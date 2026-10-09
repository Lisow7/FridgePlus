// Tests pour le mapper Schema.org Recipe enrichi.
// Refonte Recettes Phase 5b — D11.

import { describe, it, expect } from 'vitest'
import { recipeToSchemaOrg } from '../../features/recipes/lib/recipe-to-schema-org'

// Fixture : recette officielle complète
const recipeOfficial = {
  id: 'pates-carbonara',
  name: { fr: 'Pâtes carbonara', en: 'Carbonara pasta' },
  description: { fr: 'Classique italien crémeux', en: 'Creamy Italian classic' },
  emoji: '🍝',
  time_min: 30,
  prep_time_min: 10,
  cook_time_min: 20,
  difficulty: 'easy',
  type: 'plat',
  servings: 4,
  country: 'IT',
  diet: ['omnivore'],
  functional_tags: ['quick', 'kid_friendly'],
  origin: 'official',
  ingredients: [
    { ids: ['gp-pates'], qty: { amount: 400, unit: 'g' }, required: true },
    { ids: ['fr-oeuf'],  qty: { amount: 4, unit: 'pcs' }, required: true },
  ],
  steps: [{ text: 'Cuire pâtes' }, { text: 'Mélanger oeufs et fromage' }],
  created_at: '2026-05-18T10:00:00Z',
}

const countries = { IT: { names: { fr: 'Italie', en: 'Italy' } } }

describe('recipeToSchemaOrg — enrichissement D11', () => {
  it('génère @type Recipe + name', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'Pâtes carbonara', lang: 'fr', countries })
    expect(out['@type']).toBe('Recipe')
    expect(out.name).toBe('Pâtes carbonara')
  })

  it('expose prepTime + cookTime + totalTime en ISO 8601', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.prepTime).toBe('PT10M')
    expect(out.cookTime).toBe('PT20M')
    // totalTime peut venir de time_min ou de l'agrégat — accepter PT30M
    expect(out.totalTime).toMatch(/^PT/)
  })

  it('omet prepTime/cookTime si non fournis', () => {
    const recipeNoTime = { ...recipeOfficial, prep_time_min: undefined, cook_time_min: undefined }
    const out = recipeToSchemaOrg({ recipe: recipeNoTime, recipeName: 'X', lang: 'fr', countries })
    expect(out.prepTime).toBeUndefined()
    expect(out.cookTime).toBeUndefined()
  })

  it('formate >60 min en PT1H30M', () => {
    const recipeLong = { ...recipeOfficial, prep_time_min: 90, cook_time_min: 65 }
    const out = recipeToSchemaOrg({ recipe: recipeLong, recipeName: 'X', lang: 'fr', countries })
    expect(out.prepTime).toBe('PT1H30M')
    expect(out.cookTime).toBe('PT1H5M')
  })

  it('expose description du bon lang avec fallback fr', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'en', countries })
    expect(out.description).toBe('Creamy Italian classic')
    const out2 = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'ja', countries })
    expect(out2.description).toBe('Classique italien crémeux')  // fallback fr
  })

  it('omet description si absente', () => {
    const recipeNoDesc = { ...recipeOfficial, description: null }
    const out = recipeToSchemaOrg({ recipe: recipeNoDesc, recipeName: 'X', lang: 'fr', countries })
    expect(out.description).toBeUndefined()
  })

  it('expose datePublished depuis created_at en ISO date', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.datePublished).toBe('2026-05-18')
  })

  it('omet datePublished si created_at absent', () => {
    const recipeNoDate = { ...recipeOfficial, created_at: undefined }
    const out = recipeToSchemaOrg({ recipe: recipeNoDate, recipeName: 'X', lang: 'fr', countries })
    expect(out.datePublished).toBeUndefined()
  })

  it('expose keywords concaténant diet + functional_tags', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.keywords).toContain('quick')
    expect(out.keywords).toContain('kid_friendly')
    expect(out.keywords).toContain('omnivore')
  })

  it('omet keywords si diet et functional_tags vides', () => {
    const recipeNoKw = { ...recipeOfficial, diet: [], functional_tags: [] }
    const out = recipeToSchemaOrg({ recipe: recipeNoKw, recipeName: 'X', lang: 'fr', countries })
    expect(out.keywords).toBeUndefined()
  })

  it('author Organization Fridge+ pour officials', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.author).toEqual({ '@type': 'Organization', name: 'Fridge+' })
  })

  it('author Person pour custom/community avec authorName', () => {
    const recipeCustom = { ...recipeOfficial, origin: 'community', isCustom: true }
    const out = recipeToSchemaOrg({ recipe: recipeCustom, recipeName: 'X', lang: 'fr', countries, authorName: 'alice' })
    expect(out.author).toEqual({ '@type': 'Person', name: 'alice' })
  })

  it('author Organization fallback si community sans authorName', () => {
    const recipeCustom = { ...recipeOfficial, origin: 'community' }
    const out = recipeToSchemaOrg({ recipe: recipeCustom, recipeName: 'X', lang: 'fr', countries })
    expect(out.author).toEqual({ '@type': 'Organization', name: 'Fridge+' })
  })

  it('expose nutrition NutritionInformation par portion', () => {
    // Fixture avec ingrédient ayant nutrition complète (fr-poulet).
    // Nutrition = source unique BDD : on injecte une map ingredientsById factice.
    const recipeWithNutrition = {
      id: 'test-nut',
      name: { fr: 'Test nutrition' },
      servings: 2,
      ingredients: [
        { ids: ['fr-poulet'], qty: { amount: 200, unit: 'g' }, required: true },
      ],
      created_at: '2026-05-18T00:00:00Z',
    }
    const ingredientsById = new Map([['fr-poulet', { id: 'fr-poulet', nutrition: { cal: 120, prot: 23, carb: 0, fat: 3, fib: 0, al: [] } }]])
    const out = recipeToSchemaOrg({ recipe: recipeWithNutrition, recipeName: 'X', lang: 'fr', countries, ingredientsById })
    expect(out.nutrition).toBeDefined()
    expect(out.nutrition['@type']).toBe('NutritionInformation')
    expect(out.nutrition.calories).toMatch(/^\d+\s*kcal$/)
    expect(out.nutrition.proteinContent).toMatch(/g$/)
  })

  it('inclut recipeIngredient et recipeInstructions (existant)', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(Array.isArray(out.recipeIngredient)).toBe(true)
    expect(out.recipeIngredient.length).toBeGreaterThan(0)
    expect(Array.isArray(out.recipeInstructions)).toBe(true)
    expect(out.recipeInstructions[0]['@type']).toBe('HowToStep')
  })

  it('inclut recipeCuisine et recipeCategory (existant)', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.recipeCuisine).toBe('Italie')
    expect(out.recipeCategory).toBe('Main Course')
  })

  it('ne contient PAS image (différé)', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'X', lang: 'fr', countries })
    expect(out.image).toBeUndefined()
  })

  it('gère le format ingrédients enrichi (groups + sub_recipes) sans crasher', () => {
    const recipeGrouped = {
      ...recipeOfficial,
      ingredients: {
        groups: [{ name: null, items: [{ id: 'gp-pates', amount: 400, unit: 'g', required: true }] }],
        sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
      },
    }
    const out = recipeToSchemaOrg({ recipe: recipeGrouped, recipeName: 'X', lang: 'fr', countries })
    expect(Array.isArray(out.recipeIngredient)).toBe(true)
    expect(out.recipeIngredient.length).toBeGreaterThan(0)
  })
})

// ── Les 3 propriétés REQUISES par Google pour un résultat enrichi ────────────
//
// Google exige `name` + `image` + `url`. Jusqu'au 2026-08-13, seul `name` était
// émis : AUCUNE des 515 recettes n'était éligible. Ces tests figent les deux
// ajouts, et surtout leurs conditions — émettre une `url` que Google ne peut
// pas charger serait pire que de ne rien émettre.
describe('recipeToSchemaOrg — propriétés requises par Google', () => {
  it('émet `image` quand la recette a une photo', () => {
    const photo = 'https://exemple.test/recipe-photos/carbonara.webp'
    const out = recipeToSchemaOrg({
      recipe: { ...recipeOfficial, image_url: photo },
      recipeName: 'Pâtes carbonara', lang: 'fr', countries,
    })
    expect(out.image).toBe(photo)
  })

  it("n'émet pas `image` sans photo — un emoji n'est pas une image", () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'Pâtes carbonara', lang: 'fr', countries })
    expect(out).not.toHaveProperty('image')
  })

  it("n'émet pas `image` sur une chaîne vide (valeur présente en base)", () => {
    const out = recipeToSchemaOrg({
      recipe: { ...recipeOfficial, image_url: '' },
      recipeName: 'Pâtes carbonara', lang: 'fr', countries,
    })
    expect(out).not.toHaveProperty('image')
  })

  it('émet `url` absolue vers la page publique pour une recette officielle', () => {
    const out = recipeToSchemaOrg({ recipe: recipeOfficial, recipeName: 'Pâtes carbonara', lang: 'fr', countries })
    expect(out.url).toBe('https://fridgeplus.app/recipe/pates-carbonara')
  })

  it('émet `url` pour une recette communauté PUBLIÉE', () => {
    const out = recipeToSchemaOrg({
      recipe: { ...recipeOfficial, id: 'uuid-1', origin: 'community', status: 'published' },
      recipeName: 'Recette communauté', lang: 'fr', countries, authorName: 'Alice',
    })
    expect(out.url).toBe('https://fridgeplus.app/recipe/uuid-1')
  })

  it("n'émet PAS `url` pour une recette utilisateur non publiée", () => {
    // `useRecipeById` rend `not-found` : la page n'est pas atteignable, donc
    // déclarer son URL à Google serait annoncer une page introuvable.
    const out = recipeToSchemaOrg({
      recipe: { ...recipeOfficial, id: 'uuid-2', isCustom: true, status: 'draft' },
      recipeName: 'Brouillon', lang: 'fr', countries, authorName: 'Alice',
    })
    expect(out).not.toHaveProperty('url')
  })
})
