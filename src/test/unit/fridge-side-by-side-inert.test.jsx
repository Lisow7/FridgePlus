/**
 * Fix accessibilité clavier — compartiments frigo restent inertes
 * (non focusables, non activables) tant que leur porte respective est fermée.
 * Même bug que FridgeStandard (cf. fridge-standard-inert.test.jsx), reproduit
 * ici sur les deux portes indépendantes de FridgeSideBySide (layout EN).
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
import FridgeSideBySide from '@features/fridge/components/fridge-side-by-side'

// ─── Layout minimal side-by-side (EN) ────────────────────────────────────────

const MINIMAL_LAYOUT = {
  type: 'side-by-side',
  fridge: [
    {
      id: 'freezer',
      label: 'Freezer',
      flex: 1,
      subcategories: [
        { id: 'frozen-meat', label: 'Frozen meat' },
      ],
    },
    {
      id: 'fresh',
      label: 'Fresh',
      flex: 2,
      subcategories: [
        { id: 'meat', label: 'Meat' },
      ],
    },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FridgeSideBySide — compartiments inertes porte fermée', () => {
  let onDoorChange

  beforeEach(() => {
    onDoorChange = vi.fn()
    document.body.replaceChildren()
  })

  it('les deux conteneurs de compartiments sont inert quand les deux portes sont fermées', () => {
    render(
      <FridgeSideBySide
        layout={MINIMAL_LAYOUT}
        lang="en"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    expect(screen.getByTestId('fridge-compartments-left')).toHaveAttribute('inert', '')
    expect(screen.getByTestId('fridge-compartments-right')).toHaveAttribute('inert', '')
  })

  it("le conteneur gauche n'est plus inert une fois la porte gauche ouverte, le droit reste inert", () => {
    render(
      <FridgeSideBySide
        layout={MINIMAL_LAYOUT}
        lang="en"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const leftDoor = screen.getByRole('button', { name: /freezer — open the compartment/i })
    fireEvent.click(leftDoor)
    expect(screen.getByTestId('fridge-compartments-left')).not.toHaveAttribute('inert')
    expect(screen.getByTestId('fridge-compartments-right')).toHaveAttribute('inert', '')
  })

  it("le conteneur droit n'est plus inert une fois la porte droite ouverte", () => {
    render(
      <FridgeSideBySide
        layout={MINIMAL_LAYOUT}
        lang="en"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const rightDoor = screen.getByRole('button', { name: /fresh — open the compartment/i })
    fireEvent.click(rightDoor)
    expect(screen.getByTestId('fridge-compartments-right')).not.toHaveAttribute('inert')
  })
})
