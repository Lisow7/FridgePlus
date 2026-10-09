// src/test/unit/getting-started-container.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, act } from '@testing-library/react'
import { markWelcomeSeen } from '@features/onboarding'
import { markDismissed, markSuggestionOpened, isCompleted, reopenGuide } from '@features/onboarding/lib/getting-started-storage'

// État de mock mutable pour piloter chaque cas.
const mockState = vi.hoisted(() => ({ flag: true, stock: new Set() }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => mockState.flag }))
vi.mock('@shared/contexts/session-state-context', () => ({ useStockSession: () => ({ stock: mockState.stock }) }))
vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipes: [], recipeNames: { 'pasta-carbonara': { fr: 'Carbonara' } } }),
  useGroupMaps: () => ({}),
}))
const mockHasCooked = vi.hoisted(() => ({ value: false }))
vi.mock('@features/onboarding/hooks/use-has-cooked-first-dish', () => ({ useHasCookedFirstDish: () => mockHasCooked.value }))
const mockPick = vi.hoisted(() => ({ value: null }))
vi.mock('@features/onboarding/lib/pick-top-cookable', () => ({ pickTopCookable: () => mockPick.value }))
const trackOnce = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/observability/track', () => ({ trackOnce: (...a) => trackOnce(...a) }))

import GettingStartedContainer from '@features/onboarding/components/getting-started-container'

describe('GettingStartedContainer (coach)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockState.flag = true
    mockState.stock = new Set()
    mockHasCooked.value = false
    mockPick.value = null
    trackOnce.mockClear()
    markWelcomeSeen()
  })

  it('flag off → rien', () => {
    mockState.flag = false
    const { container } = render(<GettingStartedContainer lang="fr" user={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('masqué (dismissed) → rien ; reopenGuide (footer) le ré-affiche sans reload', () => {
    markDismissed('guest') // uid pour user=null
    render(<GettingStartedContainer lang="fr" user={null} onQuickAdd={() => {}} />)
    expect(screen.queryByText('On cuisine ?')).not.toBeInTheDocument()
    // Le bouton fusée du footer rouvre le guide → notify → re-render.
    act(() => { reopenGuide('guest') })
    expect(screen.getByText('On cuisine ?')).toBeInTheDocument()
  })

  it('INVITÉ frigo vide → s1 « On cuisine ? » + puces', () => {
    render(<GettingStartedContainer lang="fr" user={null} onQuickAdd={() => {}} />)
    expect(screen.getByText('On cuisine ?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tout ajouter' })).toBeInTheDocument()
  })

  it('rempli + recette READY → s2a nomme la recette + event émis', () => {
    mockState.stock = new Set(['fr-oeuf'])
    mockPick.value = { recipe: { id: 'pasta-carbonara', labels: { fr: 'Carbonara' } }, status: 'READY' }
    render(<GettingStartedContainer lang="fr" user={null} onOpenRecipe={() => {}} onSuggestionOpen={() => {}} stapleIds={new Set()} />)
    expect(screen.getByText(/Carbonara/)).toBeInTheDocument()
    expect(trackOnce).toHaveBeenCalledWith('fridge-aha-tracked', 'cookable_recipe_viewed', { recipeId: 'pasta-carbonara' })
  })

  it('rempli sans recette prête → s2b « Presque ! »', () => {
    mockState.stock = new Set(['fr-oeuf'])
    mockPick.value = { recipe: { id: 'x', labels: { fr: 'X' } }, status: 'ALMOST' }
    render(<GettingStartedContainer lang="fr" user={null} onOpenRecipes={() => {}} stapleIds={new Set()} />)
    expect(screen.getByText('Presque !')).toBeInTheDocument()
    expect(trackOnce).not.toHaveBeenCalled()
  })

  it('CONNECTÉ étapes 1+2, pas cuisiné → s3 « Plus qu\'à cuisiner ! »', () => {
    mockState.stock = new Set(['fr-oeuf'])
    markSuggestionOpened('u1')
    render(<GettingStartedContainer lang="fr" user={{ id: 'u1' }} onOpenRecipes={() => {}} />)
    expect(screen.getByText('Plus qu\'à cuisiner !')).toBeInTheDocument()
  })

  it('CONNECTÉ a cuisiné → fin « Bravo » (latch persiste au re-render ambiant)', () => {
    mockState.stock = new Set(['fr-oeuf'])
    markSuggestionOpened('u1')
    mockHasCooked.value = true
    const props = { lang: 'fr', user: { id: 'u1' }, onOpenRewards: () => {} }
    const { rerender } = render(<GettingStartedContainer {...props} />)
    expect(screen.getByText('🎉 Bravo !')).toBeInTheDocument()
    rerender(<GettingStartedContainer {...props} />)
    expect(screen.getByText('🎉 Bravo !')).toBeInTheDocument()
  })

  it('CONNECTÉ a cuisiné → fin « Bravo » survit à StrictMode (double-invoke de l\'effet de complétion)', () => {
    mockState.stock = new Set(['fr-oeuf'])
    markSuggestionOpened('u1')
    mockHasCooked.value = true
    render(
      <StrictMode>
        <GettingStartedContainer lang="fr" user={{ id: 'u1' }} onOpenRewards={() => {}} />
      </StrictMode>,
    )
    expect(screen.getByText('🎉 Bravo !')).toBeInTheDocument()
  })

  it('CONNECTÉ étapes 1+2 sans cuisiner : PAS de célébration, s3 visible (survit à StrictMode)', () => {
    mockState.stock = new Set(['fr-oeuf'])
    markSuggestionOpened('u1')
    render(
      <StrictMode>
        <GettingStartedContainer lang="fr" user={{ id: 'u1' }} onOpenRecipes={() => {}} />
      </StrictMode>,
    )
    expect(screen.queryByText('🎉 Bravo !')).not.toBeInTheDocument()
    expect(screen.getByText('Plus qu\'à cuisiner !')).toBeInTheDocument()
  })

  it('CONNECTÉ complété session ANTÉRIEURE → carte retirée (null)', () => {
    localStorage.setItem('fridge-getting-started-v1:u1', JSON.stringify({ completed_v3: true, step2_opened: true }))
    mockState.stock = new Set(['fr-oeuf'])
    mockHasCooked.value = true
    const { container } = render(<GettingStartedContainer lang="fr" user={{ id: 'u1' }} onOpenRewards={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('INVITÉ complété (frigo+Aha) → fin inscription + markCompleted(guest) [retrait]', () => {
    mockState.stock = new Set(['fr-oeuf'])
    markSuggestionOpened('guest')
    render(<GettingStartedContainer lang="fr" user={null} onSignUp={() => {}} />)
    expect(screen.getByText('🎉 Et voilà !')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Créer mon compte/ })).toBeInTheDocument()
    expect(isCompleted('guest')).toBe(true) // NOUVEAU : l'invité complété est marqué → retiré ensuite
  })

  it('INVITÉ complété session ANTÉRIEURE → carte retirée (null)', () => {
    localStorage.setItem('fridge-getting-started-v1:guest', JSON.stringify({ completed_v3: true, step2_opened: true }))
    mockState.stock = new Set(['fr-oeuf'])
    const { container } = render(<GettingStartedContainer lang="fr" user={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('réduite (dismissed) → guide masqué (le point d\'entrée vit dans le footer)', () => {
    markDismissed('u1')
    const { container } = render(<GettingStartedContainer lang="fr" user={{ id: 'u1' }} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('On cuisine ?')).not.toBeInTheDocument()
  })
})
