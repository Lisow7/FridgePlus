/**
 * Task 1 — FAB rework (#7)
 * Vérifie que le frigo fermé peut être ouvert par tap/clic (affordance)
 * et que cette affordance est accessible (role=button + aria-label + clavier).
 * Couverture : FridgeStandard (top-freezer / FR).
 * FridgeSideBySide et FridgeMultiDoor ont déjà role/aria/onKeyDown
 * intégrés dans leurs portes — vérifiés par lecture du code (no-regression ici).
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

// FoodIcon fait une image → mock pour éviter les erreurs img jsdom
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

describe('FridgeStandard — affordance tap-to-open (Task 1 #7)', () => {
  let onDoorChange

  beforeEach(() => {
    onDoorChange = vi.fn()
    document.body.replaceChildren()
  })

  it('expose un bouton accessible "Ouvrir le frigo" quand le frigo est fermé', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const btn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    expect(btn).toBeInTheDocument()
  })

  it('le clic sur la porte fermée déclenche onDoorChange(true)', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const btn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    fireEvent.click(btn)
    expect(onDoorChange).toHaveBeenCalledWith(true)
  })

  it('la touche Enter sur la porte fermée ouvre le frigo', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const btn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(onDoorChange).toHaveBeenCalledWith(true)
  })

  it('la touche Espace sur la porte fermée ouvre le frigo', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const btn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(onDoorChange).toHaveBeenCalledWith(true)
  })

  it('label EN : aria-label "Open the fridge" quand lang="en"', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="en"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    expect(screen.getByRole('button', { name: /open the fridge/i })).toBeInTheDocument()
  })

  it('tabIndex=0 quand le frigo est fermé (focusable)', () => {
    render(
      <FridgeStandard
        layout={MINIMAL_LAYOUT}
        lang="fr"
        onDoorChange={onDoorChange}
        stock={new Set()}
      />
    )
    const btn = screen.getByRole('button', { name: /ouvrir le frigo/i })
    expect(btn).toHaveAttribute('tabindex', '0')
  })
})
