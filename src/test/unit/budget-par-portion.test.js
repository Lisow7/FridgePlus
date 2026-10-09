import { describe, it, expect } from 'vitest'
import { respecteLeBudget, budgetQuiFiltre } from '@features/recipes/lib/recipe-budget'

// Audit du 2026-10-04, UX-07. Le curseur « Budget maximum » annonce « Au plus
// X € par portion », mais comparait le coût TOTAL de la recette : une recette
// de 4 portions à 6 € (1,50 € la portion) disparaissait sous un plafond de
// « 3 € par portion ».

// Un identifiant inventé : aucun prix de secours (PACK_SIZES) ne s'en mêle.
const OIGNON = { id: 'zz-oignon-de-test', price: { fr: [{ size: 100, unit: 'g', price: 1 }] } } // 1 € les 100 g
const CATALOGUE = new Map([[OIGNON.id, OIGNON]])
const recette = (servings, grammes) => ({ id: 'r', servings, ingredients: [{ ids: [OIGNON.id], qty: { amount: grammes, unit: 'g' } }] })

describe('budget maximum : le prix PAR PORTION', () => {
  it('une recette de 4 portions à 6 € (1,50 € la portion) passe sous « 3 € par portion »', () => {
    expect(respecteLeBudget(recette(4, 600), 3, { lang: 'fr', ingredientsById: CATALOGUE })).toBe(true)
  })

  it('une portion à 4 € dépasse « 3 € par portion »', () => {
    expect(respecteLeBudget(recette(2, 800), 3, { lang: 'fr', ingredientsById: CATALOGUE })).toBe(false)
  })

  it('sans plafond, tout passe ; sans prix ou sans portions, la recette est écartée', () => {
    expect(respecteLeBudget(recette(4, 600), null, { lang: 'fr', ingredientsById: CATALOGUE })).toBe(true)
    expect(respecteLeBudget(recette(4, 600), 3, { lang: 'fr', ingredientsById: new Map() })).toBe(false)
    expect(respecteLeBudget(recette(0, 600), 3, { lang: 'fr', ingredientsById: CATALOGUE })).toBe(false)
  })
})

// Les coûts ne se voient qu'avec l'accès Premium (carte, onglet « Coût ») :
// pour les autres, le curseur est masqué — et un lien partagé `?maxBud=3`
// ne doit pas filtrer en silence, sans curseur à l'écran pour le retirer.
describe('le budget ne filtre que pour qui voit les coûts', () => {
  it('coûts visibles : le plafond s’applique', () => {
    expect(budgetQuiFiltre(3, true)).toBe(3)
  })
  it('coûts invisibles : aucun plafond, même venu de l’adresse', () => {
    expect(budgetQuiFiltre(3, false)).toBe(null)
    expect(budgetQuiFiltre(null, true)).toBe(null)
  })
})
