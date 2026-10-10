import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Les puces allergènes d'une carte : dérivées des ingrédients servis par la
// base (card-allergens), nommées, celles du profil en tête et en gras. Un test
// e2e le promettait depuis la v3.6.3 mais se sautait lui-même — le socle e2e
// sert des tables vides (audit du 2026-10-04, ARCH-17 (3)). Ici, la carte est
// montée avec un ingrédient qui porte un allergène.

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipeNames: { carbonara: { fr: 'Pasta Carbonara' } }, recipesById: new Map() }),
  useCountries: () => ({}), useDietTypes: () => ({}),
  useAllergenTypes: () => ({
    gluten: { icon: '🌾', labels: { fr: 'Gluten', en: 'Gluten' } },
    lait:   { icon: '🥛', labels: { fr: 'Lait', en: 'Milk' } },
  }),
  useIngredientsById: () => new Map([
    ['gp-spaghetti', { id: 'gp-spaghetti', allergens: ['gluten'] }],
    ['fr-parmesan',  { id: 'fr-parmesan',  allergens: ['lait'] }],
  ]),
}))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ hasPremiumAccess: false }) }))
vi.mock('@shared/contexts/subscription-modal-provider', () => ({ useUpgradeModal: () => ({ open: vi.fn() }) }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1280 }))
vi.mock('@shared/ui/emoji', () => ({ default: ({ char }) => char }))

import RecipeCard from '@features/recipes/components/recipe-card'

const recette = {
  id: 'carbonara', emoji: '🍝', time: '20 min', difficulty: 'Facile', type: 'Plat principal', servings: 2, diet: [],
  ingredients: [
    { ids: ['gp-spaghetti'], labels: { fr: 'spaghetti' }, required: true },
    { ids: ['fr-parmesan'],  labels: { fr: 'parmesan' },  required: true },
  ],
}
const T = { addFav: 'Ajouter aux favoris', removeFav: 'Retirer des favoris', addToCart: 'Ajouter au panier', alreadyInCart: 'Déjà au panier' }

const monter = (props = {}) => render(
  <RecipeCard recipe={recette} lang="fr" darkMode={false} stock={new Set()} isFavorite={false}
    onToggleFavorite={vi.fn()} onOpen={vi.fn()} t={T} {...props} />,
)

describe('carte de recette — puces allergènes', () => {
  it('une puce nommée par allergène dérivé des ingrédients', () => {
    monter()
    expect(screen.getByTitle('Gluten')).toHaveTextContent('🌾 Gluten')
    expect(screen.getByTitle('Lait')).toHaveTextContent('🥛 Lait')
  })

  it('un allergène du profil passe en tête, en gras', () => {
    monter({ allergenPrefs: ['lait'] })
    const puces = [screen.getByTitle('Lait'), screen.getByTitle('Gluten')]
    expect(puces[0].compareDocumentPosition(puces[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(puces[0].style.fontWeight).toBe('700')
    expect(puces[1].style.fontWeight).toBe('500')
  })

  it('sans allergène connu des ingrédients, aucune puce', () => {
    monter({ recipe: { ...recette, ingredients: [{ ids: ['vg-carotte'], labels: { fr: 'carotte' }, required: true }] } })
    expect(screen.queryByTitle('Gluten')).toBeNull()
    expect(screen.queryByTitle('Lait')).toBeNull()
  })
})
