import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'

// Audit du 2026-10-04, SEO-02 : aucun lien ne menait aux 515 fiches — une
// carte était un `<div role="button">` qui ouvrait la fiche par `navigate()`.
// Un robot n'y voyait rien à suivre, et le `role="button"` contenait d'autres
// boutons (favori, panier : éléments interactifs imbriqués). Le nom de la
// recette est maintenant un vrai lien, étiré sur toute la carte.

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

const recette = { id: 'carbonara', emoji: '🍝', time: '20 min', difficulty: 'Facile', type: 'Plat principal', servings: 2, ingredients: [], diet: [], allergens: [], matchPercent: 0.5 }
const T = { addFav: 'Ajouter aux favoris', removeFav: 'Retirer des favoris', addToCart: 'Ajouter au panier', alreadyInCart: 'Déjà au panier', cartAllInFridge: 'Tout est au frigo' }

function rendre() {
  const onOpen = vi.fn()
  const onToggleFavorite = vi.fn()
  const vue = render(<RecipeCard recipe={recette} lang="fr" darkMode={false} stock={new Set()} isFavorite={false}
    onToggleFavorite={onToggleFavorite} onOpen={onOpen} t={T} />)
  return { onOpen, onToggleFavorite, ...vue }
}

const lien = () => screen.getByRole('link', { name: 'Pasta Carbonara' })

describe('la carte de recette est un vrai lien vers sa fiche', () => {
  it('le nom est un lien qu’un robot peut suivre', () => {
    rendre()
    expect(lien()).toHaveAttribute('href', expect.stringMatching(/\/recipe\/carbonara$/))
  })

  it('un clic simple ouvre la fiche DANS l’app (le défilement du panneau est gardé), sans recharger la page', () => {
    const { onOpen } = rendre()
    const clic = createEvent.click(lien(), { button: 0 })
    fireEvent(lien(), clic)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(clic.defaultPrevented).toBe(true)
  })

  it('Ctrl+clic, Cmd+clic, Maj+clic : le navigateur ouvre un nouvel onglet, l’app ne fait rien', () => {
    const { onOpen } = rendre()
    for (const touche of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      const clic = createEvent.click(lien(), { button: 0, ...touche })
      fireEvent(lien(), clic)
      expect(clic.defaultPrevented).toBe(false)
    }
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('le favori ne fait pas ouvrir la fiche', () => {
    const { onOpen, onToggleFavorite } = rendre()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))
    expect(onToggleFavorite).toHaveBeenCalledWith('carbonara')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('plus rien ne joue le bouton : aucun bouton n’en contient un autre', () => {
    const { container } = rendre()
    expect(container.querySelector('[role="button"]')).toBeNull()
    expect(container.querySelector('[data-recipe-id="carbonara"]')).not.toBeNull()
  })
})
