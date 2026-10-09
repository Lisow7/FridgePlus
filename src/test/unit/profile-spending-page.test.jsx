import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// v3.412 PR-E — nouvelle page dédiée /profile/depenses (Premium-gated).
// Tests : paywall si free, dashboard si premium.

vi.mock('@shared/contexts/subscription-modal-provider', () => ({
  useUpgradeModal: () => ({ openUpgradeModal: vi.fn() }),
}))

vi.mock('@shared/ui/upgrade-gate', () => ({
  UpgradeGate: () => <div data-testid="upgrade-gate" />,
}))

vi.mock('@features/profile/components/spending-dashboard', () => ({
  default: () => <div data-testid="spending-dashboard" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({ lang: 'fr', darkMode: false, user: { id: 'u1' } }),
  }
})

let isPremium = false
vi.mock('@shared/hooks/use-subscription', () => ({
  useSubscription: () => ({ hasPremiumAccess: isPremium }),
}))

import ProfileSpendingPage from '@features/profile/pages/profile-spending-page'

describe('ProfileSpendingPage (PR-E v3.412)', () => {
  it('affiche le paywall UpgradeGate si pas Premium', () => {
    isPremium = false
    render(<MemoryRouter><ProfileSpendingPage /></MemoryRouter>)
    expect(screen.getByTestId('upgrade-gate')).toBeInTheDocument()
    expect(screen.queryByTestId('spending-dashboard')).not.toBeInTheDocument()
  })

  it('affiche le dashboard si Premium', () => {
    isPremium = true
    render(<MemoryRouter><ProfileSpendingPage /></MemoryRouter>)
    expect(screen.getByTestId('spending-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('upgrade-gate')).not.toBeInTheDocument()
  })

  it('rend le titre H1 « Mes dépenses »', () => {
    isPremium = true
    render(<MemoryRouter><ProfileSpendingPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: /mes dépenses/i })).toBeInTheDocument()
  })

  it('affiche le badge Premium sur la section si pas Premium', () => {
    isPremium = false
    render(<MemoryRouter><ProfileSpendingPage /></MemoryRouter>)
    // Le badge est nommé par son texte visible (l'aria-label en double était interdit, A11Y-19).
    expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(1)
  })
})
