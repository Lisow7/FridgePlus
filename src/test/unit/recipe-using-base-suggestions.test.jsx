// Tests unit — RecipeUsingBaseSuggestions, extrait de recipe-modal.jsx
// (audit front §2). Section « Recettes qui utilisent cette recette » :
// présentationnelle, ne s'affiche que si au moins une suggestion est résolvable.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))
vi.mock('@shared/lib/recipes/recipe-i18n', () => ({
  pickLocalizedName: (names, _sub, lang, id) => names?.[lang] ?? id,
}))

import RecipeUsingBaseSuggestions from '@features/recipes/components/recipe-using-base-suggestions'

const t = { usingBaseLabel: 'Recettes qui utilisent celle-ci' }

function makeRecipesById(map) {
  return { get: (id) => map[id] }
}

describe('RecipeUsingBaseSuggestions', () => {
  it("n'affiche rien si aucune suggestion n'est résolvable", () => {
    const { container } = render(
      <RecipeUsingBaseSuggestions
        ids={['orphan']}
        recipesById={makeRecipesById({})}
        recipeNames={{}}
        t={t}
        onSelect={() => {}}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche un bouton par suggestion résolvable, avec son nom', () => {
    render(
      <RecipeUsingBaseSuggestions
        ids={['r1', 'orphan', 'r2']}
        recipesById={makeRecipesById({ r1: { emoji: '🥧' }, r2: { emoji: '🍲' } })}
        recipeNames={{ r1: { fr: 'Tarte' }, r2: { fr: 'Soupe' } }}
        t={t}
        lang="fr"
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Recettes qui utilisent celle-ci')).toBeInTheDocument()
    expect(screen.getByText('Tarte')).toBeInTheDocument()
    expect(screen.getByText('Soupe')).toBeInTheDocument()
    // l'id orphelin (non résolvable) ne produit pas de bouton
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('appelle onSelect avec l\'id au clic', () => {
    const onSelect = vi.fn()
    render(
      <RecipeUsingBaseSuggestions
        ids={['r1']}
        recipesById={makeRecipesById({ r1: { emoji: '🥧' } })}
        recipeNames={{ r1: { fr: 'Tarte' } }}
        t={t}
        lang="fr"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith('r1')
  })
})
