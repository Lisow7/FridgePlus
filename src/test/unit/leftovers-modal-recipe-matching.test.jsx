import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: vi.fn() }))
vi.mock('@shared/hooks/use-focus-trap', () => ({ useFocusTrap: vi.fn() }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: vi.fn() }) }))
vi.mock('@features/fridge/api/leftovers', () => ({ isLeftoverExpired: () => false }))

const bechamelGroupee = {
  id: 'bechamel-groupee-test',
  ingredients: {
    groups: [
      { name: null, items: [{ ids: ['fr-beurre'], required: true }] },
      { name: { fr: 'Assaisonnement' }, items: [{ ids: ['sp-sel'], required: false }] },
    ],
    sub_recipes: [],
  },
}

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({ frais: [] }),
  useBaseRecipes: () => ({ recipes: [bechamelGroupee], recipeNames: {} }),
  useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
}))

import LeftoversModal from '@features/fridge/components/leftovers-modal'

describe('LeftoversModal — recettes disponibles (format ingrédients enrichi)', () => {
  // Régression : recipeHasSeasonalIngredient/scoreRecipes crashaient sur ce
  // format ailleurs dans le code ; ici pas de crash (garde Array.isArray)
  // mais la recette était silencieusement exclue de l’onglet des recettes —
  // trouvé en audit indépendant 2026-07-14.
  it("propose une recette au format enrichi (groups) dans l'onglet Recettes", () => {
    render(
      <LeftoversModal
        view="today"
        leftovers={[]}
        stock={new Set(['fr-beurre'])}
        customRecipes={[]}
        publicRecipes={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        lang="fr"
        darkMode={false}
        onClose={vi.fn()}
        user={{ id: 'u1' }}
        onShowAuth={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Ajouter un reste'))
    fireEvent.click(screen.getByText('Recettes'))

    expect(screen.queryByText('Aucune recette disponible.')).not.toBeInTheDocument()
    expect(screen.getByText('bechamel-groupee-test')).toBeInTheDocument()
  })
})
