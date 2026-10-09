/**
 * Fix accessibilité clavier — compartiments frigo restent inertes
 * (non focusables, non activables) tant que la porte est fermée.
 * Bug reproduit en localhost 2026-07-07 : Tab jusqu'au bouton "Frais"
 * porte fermée → tabIndex 0 → Entrée → compartiment s'étend silencieusement
 * derrière la porte fermée (aucun retour visuel).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
}))

vi.mock('@shared/hooks/use-window-width', () => ({
  useWindowWidth: () => 1200,
}))

vi.mock('@features/fridge/api/leftovers', () => ({
  isLeftoverExpired: () => false,
}))

vi.mock('@shared/ui/food-icon', () => ({
  default: ({ id }) => <span data-testid={`food-icon-${id}`} />,
}))

// Import après les mocks
import FridgeStandard from '@features/fridge/components/fridge-standard'

// ─── Layout minimal top-freezer (FR) ─────────────────────────────────────────

const MINIMAL_LAYOUT = {
  type: 'top-freezer',
  fridge: [
    {
      id: 'freezer',
      label: 'Congélateur',
      flex: 1,
      subcategories: [
        { id: 'frozen-meat', label: 'Viande congelée' },
      ],
    },
    {
      id: 'fresh',
      label: 'Frais',
      flex: 2,
      subcategories: [
        { id: 'meat', label: 'Viande' },
      ],
    },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FridgeStandard — compartiments inertes porte fermée', () => {
  let onDoorChange

  beforeEach(() => {
    onDoorChange = vi.fn()
    document.body.replaceChildren()
  })

  it('le conteneur des compartiments est inert quand la porte est fermée', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const container = screen.getByTestId('fridge-compartments')
    expect(container).toHaveAttribute('inert', '')
  })

  it("le conteneur des compartiments n'est plus inert une fois la porte ouverte", () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const openBtn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    fireEvent.click(openBtn)
    const container = screen.getByTestId('fridge-compartments')
    expect(container).not.toHaveAttribute('inert')
  })
})
