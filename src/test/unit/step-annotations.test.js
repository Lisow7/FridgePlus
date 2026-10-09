import { describe, it, expect } from 'vitest'
import { splitStepWithAnnotations } from '@shared/lib/recipes/step-annotations'

const recipesById = new Map([
  ['bechamel-maison', { id: 'bechamel-maison' }],
  ['houmous', { id: 'houmous' }],
])

describe('splitStepWithAnnotations', () => {
  it('texte sans terme → un seul segment text', () => {
    const s = splitStepWithAnnotations('Rien à signaler.', 'fr', { currentRecipeId: 'lasagnes', recipesById })
    expect(s).toEqual([{ type: 'text', value: 'Rien à signaler.' }])
  })

  it('terme de glossaire → segment kind glossary', () => {
    const s = splitStepWithAnnotations("Émincer l'oignon.", 'fr', { currentRecipeId: 'lasagnes', recipesById })
    const term = s.find(x => x.type !== 'text')
    expect(term).toMatchObject({ type: 'glossary', id: 'emincer' })
  })

  it('terme recette de base existante → segment kind base-recipe avec payload = recipeIds résolus', () => {
    const s = splitStepWithAnnotations('Prépare une béchamel.', 'fr', { currentRecipeId: 'lasagnes', recipesById })
    const term = s.find(x => x.type !== 'text')
    expect(term).toMatchObject({ type: 'base-recipe', id: 'bechamel' })
    expect(term.payload).toEqual(['bechamel-maison'])
  })

  it('terme recette de base NON créée → reste du texte simple (aucun segment matché)', () => {
    const s = splitStepWithAnnotations('Ajoute du pesto.', 'fr', { currentRecipeId: 'lasagnes', recipesById })
    expect(s.every(x => x.type === 'text')).toBe(true)
  })

  it('garde-fou auto-lien : sur la fiche de la recette de base elle-même, le mot reste du texte simple', () => {
    const s = splitStepWithAnnotations('Prépare une béchamel.', 'fr', { currentRecipeId: 'bechamel-maison', recipesById })
    expect(s.every(x => x.type === 'text')).toBe(true)
  })

  it('sans currentRecipeId/recipesById (params omis) → aucun lien recette de base, glossaire fonctionne toujours', () => {
    const s = splitStepWithAnnotations("Émincer l'oignon puis prépare une béchamel.", 'fr', {})
    const kinds = s.filter(x => x.type !== 'text').map(x => x.type)
    expect(kinds).toEqual(['glossary'])
  })

  it('un même mot dans les deux dictionnaires : le lien recette de base gagne (précédence)', () => {
    // 'houmous' est un plat existant dans BASE_RECIPE_LINKS ; on vérifie juste
    // qu'un terme qui matcherait glossaire ET base-recipe choisit base-recipe.
    // (Régression structurelle : couvert directement par text-term-matcher.test.js
    // ; ici on vérifie que step-annotations respecte l'ordre glossaire-puis-lien.)
    const s = splitStepWithAnnotations('Sers avec du houmous.', 'fr', { currentRecipeId: 'lasagnes', recipesById })
    const term = s.find(x => x.type !== 'text')
    expect(term.type).toBe('base-recipe')
  })
})
