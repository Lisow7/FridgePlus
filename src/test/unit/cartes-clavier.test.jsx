import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Une touche sur un bouton DANS une carte ne déclenche pas la carte (audit du
// 2026-10-04, A11Y-04).
//
// Les cartes de recette étaient des `role="button"` qui écoutaient Entrée et Espace
// (depuis SEO-02, le nom de la recette est un vrai lien étiré sur la carte).
// Le `keydown` d'un bouton interne remontait jusqu'à elles : « Ajouter aux
// favoris » au clavier ouvrait aussi la recette — un utilisateur au clavier ne
// pouvait pas mettre une recette en favori sans l'ouvrir.

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipeNames: { carbonara: { fr: 'Pasta Carbonara' } }, recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(),
}))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/contexts/subscription-modal-provider', () => ({ useUpgradeModal: () => ({ open: vi.fn() }) }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1280 }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))

import RecipeCard from '@features/recipes/components/recipe-card'

const recette = { id: 'carbonara', emoji: '🍝', time: '20 min', difficulty: 'Facile', type: 'Plat principal', servings: 2, ingredients: [], diet: [], allergens: [] }
const T = { addFav: 'Ajouter aux favoris', removeFav: 'Retirer des favoris', addToCart: 'Ajouter au panier', alreadyInCart: 'Déjà au panier', cartAllInFridge: 'Tout est au frigo' }

function rendre() {
  const onOpen = vi.fn()
  const onToggleFavorite = vi.fn()
  render(<RecipeCard recipe={recette} lang="fr" darkMode={false} stock={new Set()} isFavorite={false}
    onToggleFavorite={onToggleFavorite} onOpen={onOpen} t={T} />)
  return { onOpen, onToggleFavorite }
}

describe('carte de recette au clavier', () => {
  it('Entrée sur « Ajouter aux favoris » ne fait PAS ouvrir la recette', () => {
    const { onOpen } = rendre()
    const favori = screen.getByRole('button', { name: 'Ajouter aux favoris' })

    fireEvent.keyDown(favori, { key: 'Enter' })

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Espace sur le bouton favori ne fait pas non plus ouvrir la recette', () => {
    const { onOpen } = rendre()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Ajouter aux favoris' }), { key: ' ' })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('au clavier, on atteint le LIEN de la carte, et Entrée l’active (le navigateur en fait un clic)', () => {
    const { onOpen } = rendre()
    const lien = screen.getByRole('link', { name: 'Pasta Carbonara' })
    expect(lien).not.toHaveAttribute('tabindex', '-1')
    fireEvent.click(lien, { button: 0 })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
