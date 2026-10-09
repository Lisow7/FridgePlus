import { describe, it, expect } from 'vitest'
import { ligneIngredient } from '@shared/lib/recipes/recipe-ingredients'
import { recipeToSchemaOrg } from '@features/recipes/lib/recipe-to-schema-org'

// UNE seule façon d'écrire une ligne d'ingrédient pour le balisage Recipe
// (audit du 2026-10-04, SEO-06).
//
// Le balisage injecté au montage (client) et celui servi dans le HTML
// pré-rendu (robots sans JavaScript) doivent dire la même chose : deux copies
// d'une même règle finissent toujours par diverger. La fiche affiche le NOM DE
// BASE et la quantité (« Spaghetti — 200 g »), pas la ligne rédigée d'origine :
// le balisage suit ce qui est visible.

const NOMS = new Map([
  ['gp-spaghetti', { labels: { fr: 'Spaghetti', en: 'Spaghetti' } }],
  ['fr-oeufs-standard', { labels: { fr: 'Œufs', en: 'Eggs' } }],
  ['sp-poivre-noir', { labels: { fr: 'Poivre noir', en: 'Black pepper' } }],
])

const SPAGHETTI = { ids: ['gp-spaghetti', 'gp-tagliatelles'], qty: { unit: 'g', amount: 200 }, labels: { fr: '200g de spaghetti', en: '200g spaghetti' }, required: true }
const OEUFS = { ids: ['fr-oeufs-standard', 'fr-oeufs-bio'], qty: { unit: 'pcs', amount: 3 }, labels: { fr: '3 œufs (1 entier + 2 jaunes)' }, required: true }
const POIVRE = { ids: ['sp-poivre-noir'], qty: { unit: 'pm', amount: null }, labels: { fr: 'Poivre noir, généreusement' }, required: false }

describe('une ligne d’ingrédient', () => {
  it('une masse : « 200 g de Spaghetti »', () => {
    expect(ligneIngredient(SPAGHETTI, NOMS, 'fr')).toBe('200 g de Spaghetti')
  })

  it('des pièces : « 3 Œufs », sans « de »', () => {
    expect(ligneIngredient(OEUFS, NOMS, 'fr')).toBe('3 Œufs')
  })

  it('sans quantité : le nom seul', () => {
    expect(ligneIngredient(POIVRE, NOMS, 'fr')).toBe('Poivre noir')
  })

  it('dans la langue demandée', () => {
    expect(ligneIngredient(OEUFS, NOMS, 'en')).toBe('3 Eggs')
  })

  it('nom de base inconnu : la ligne rédigée de la recette', () => {
    const inconnu = { ids: ['zz-inconnu'], labels: { fr: 'Une pincée de mystère' } }
    expect(ligneIngredient(inconnu, NOMS, 'fr')).toBe('Une pincée de mystère')
  })

  it('format enrichi { id, amount, unit } : même écriture', () => {
    expect(ligneIngredient({ id: 'gp-spaghetti', alternatives: [], amount: 200, unit: 'g' }, NOMS, 'fr')).toBe('200 g de Spaghetti')
  })

  it('sans table des noms : la ligne rédigée, puis l’identifiant', () => {
    expect(ligneIngredient({ ids: ['zz-inconnu'], labels: { fr: 'Une pincée de mystère' } }, null, 'fr')).toBe('Une pincée de mystère')
    expect(ligneIngredient({ ids: ['gp-sel'] }, null, 'fr')).toBe('gp-sel')
  })
})

describe('le balisage client écrit ses ingrédients avec cette même règle', () => {
  it('mêmes lignes, dans le même ordre', () => {
    const recipe = { id: 'carbonara', ingredients: [SPAGHETTI, OEUFS, POIVRE], steps: { fr: ['Cuire.'] } }
    const { recipeIngredient } = recipeToSchemaOrg({ recipe, recipeName: 'Carbonara', lang: 'fr', ingredientsById: NOMS })
    expect(recipeIngredient).toEqual(['200 g de Spaghetti', '3 Œufs', 'Poivre noir'])
    expect(recipeIngredient).toEqual(recipe.ingredients.map((i) => ligneIngredient(i, NOMS, 'fr')))
  })
})
