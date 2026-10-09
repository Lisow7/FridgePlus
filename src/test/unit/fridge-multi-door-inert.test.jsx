/**
 * Fix accessibilité clavier — le compartiment "fraîche" (portes françaises)
 * reste inert (non focusable, non activable) tant que les deux portes sont
 * fermées. Même bug que FridgeStandard (cf. fridge-standard-inert.test.jsx).
 * Les tiroirs (DrawerSection) ne sont pas concernés : ils ne sont jamais
 * cachés derrière une porte, leur bouton fermé est déjà l'élément visible.
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

vi.mock('@shared/ui/food-icon', () => ({
  default: ({ id }) => <span data-testid={`food-icon-${id}`} />,
}))

// Import après les mocks
import FridgeMultiDoor from '@features/fridge/components/fridge-multi-door'

// ─── Layout minimal multi-door (FR) ──────────────────────────────────────────

const MINIMAL_LAYOUT = {
  type: 'multi-door',
  fridge: [
    {
      id: 'fresh',
      label: 'Frais',
      flex: 3,
      subcategories: [
        { id: 'meat', label: 'Viande' },
      ],
    },
    {
      id: 'freezer',
      label: 'Congélateur',
      flex: 1,
      subcategories: [
        { id: 'frozen-meat', label: 'Viande congelée' },
      ],
    },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FridgeMultiDoor — compartiment "fraîche" inert portes fermées', () => {
  let onDoorChange

  beforeEach(() => {
    onDoorChange = vi.fn()
    document.body.replaceChildren()
  })

  it('le conteneur du compartiment fraîche est inert quand les deux portes sont fermées', () => {
    render(
      <FridgeMultiDoor
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    expect(screen.getByTestId('fridge-compartments-fresh')).toHaveAttribute('inert', '')
  })

  it("le conteneur n'est plus inert une fois une porte ouverte (les deux s'ouvrent ensemble)", () => {
    render(
      <FridgeMultiDoor
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const leftDoor = screen.getByRole('button', { name: /ouvrir la porte gauche du frigo/i })
    fireEvent.click(leftDoor)
    expect(screen.getByTestId('fridge-compartments-fresh')).not.toHaveAttribute('inert')
  })
})
