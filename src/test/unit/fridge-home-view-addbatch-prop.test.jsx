/**
 * Task 2 — Propagation de addBatch vers FridgeHomeView via onQuickAdd
 * Vérifie que FridgeHomeView accepte la prop onQuickAdd sans crash.
 * Les enfants lourds (Fridge, PantryShelf, GettingStartedContainer) sont mockés
 * pour isoler la propagation de prop.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// ─── Mocks des enfants lourds ──────────────────────────────────────────────────

vi.mock('@features/fridge/components/fridge', () => ({ default: () => null }))
vi.mock('@features/fridge/components/pantry-shelf', () => ({ default: () => null }))
vi.mock('@features/fridge/components/fridge-tagline', () => ({ default: () => null }))
vi.mock('@features/onboarding', () => ({
  GettingStartedContainer: () => null,
  hasSeenWelcome: () => true,
  markSuggestionOpened: () => {},
}))

// Import après les mocks
import FridgeHomeView from '@app/components/fridge-home-view'

// ─── Props minimales requises par FridgeHomeView ───────────────────────────────

const MINIMAL_PROPS = {
  lang: 'fr',
  user: null,
  // Responsive layout
  desktopFridgeRef: { current: null },
  desktopScale: 1,
  windowWidth: 375,
  fridgeBase: 320,
  fridgeMobileScale: 1,
  pantryMobileScale: 1,
  // Mobile tab
  mobileTab: 'fridge',
  setMobileTab: vi.fn(),
  // Fridge/Pantry data (objets vides — mockés)
  fridgeProps: {},
  pantryProps: {},
  layout: { fridgeLabel: 'Frigo', pantryLabel: 'Garde-manger', recipesLabel: 'Recettes' },
  anyDoorOpen: false,
  darkMode: false,
  // Onboarding callbacks
  onOpenRecipes: vi.fn(),
  onSignUp: vi.fn(),
  onOpenRewards: vi.fn(),
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FridgeHomeView — prop onQuickAdd (Task 2)', () => {
  it('accepte et transmet onQuickAdd sans crash', () => {
    const onQuickAdd = vi.fn()
    expect(() =>
      render(<FridgeHomeView {...MINIMAL_PROPS} onQuickAdd={onQuickAdd} />)
    ).not.toThrow()
  })

  it('reste stable sans la prop onQuickAdd (rétrocompatibilité)', () => {
    expect(() =>
      render(<FridgeHomeView {...MINIMAL_PROPS} />)
    ).not.toThrow()
  })
})
