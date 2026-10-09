import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const mockConsent = vi.hoisted(() => ({ hasDecided: true }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({
    hasDecided: mockConsent.hasDecided, consent: { essential: true },
    accept: vi.fn(), refuse: vi.fn(), save: vi.fn(),
    setVoiceConsent: vi.fn(), setReceiptScanConsent: vi.fn(), reset: vi.fn(),
  }),
}))
vi.mock('@features/onboarding/components/welcome-screen', () => ({ default: () => null }))
vi.mock('@features/pwa/components/update-prompt', () => ({ default: () => null }))
vi.mock('@features/premium/components/upgrade-modal', () => ({ default: () => null }))
vi.mock('@features/auth/components/accord-des-anciens-comptes', () => ({ default: () => <div data-testid="accord">Confirme ton accord</div> }))

import GlobalOverlays from '@app/components/global-overlays'

// Décision du 2026-10-07 (« fenetre ») : la fenêtre « Confirme ton accord » se monte pour
// un compte dont le profil dit, explicitement, qu'il n'a pas de date d'accord
// — et seulement une fois les cookies tranchés (le bandeau la recouvrirait).

// Chargée à la demande : on laisse le chargement se résoudre avant chaque
// vérification, présence comme absence.
const laisserCharger = () => act(() => new Promise((r) => setTimeout(r, 0)))
const BOB = { id: 'u-bob' }
const base = { welcomeOpen: false, onWelcomeClose: vi.fn(), lang: 'fr', darkMode: false, authLoading: false }

describe('GlobalOverlays — la fenêtre d’accord des comptes d’avant le 4 octobre', () => {
  it('compte sans date d’accord : la fenêtre s’ouvre', async () => {
    mockConsent.hasDecided = true
    render(<GlobalOverlays {...base} user={BOB} profile={{ id: 'u-bob', consent_terms_accepted_at: null }} />)
    expect(await screen.findByTestId('accord')).toBeInTheDocument()
  })

  it('compte qui a déjà daté son accord : rien', async () => {
    mockConsent.hasDecided = true
    render(<GlobalOverlays {...base} user={BOB} profile={{ id: 'u-bob', consent_terms_accepted_at: '2026-10-04T12:00:00Z' }} />)
    await laisserCharger()
    expect(screen.queryByTestId('accord')).toBeNull()
  })

  it('visiteur, ou profil pas encore lu (champ absent) : rien', async () => {
    mockConsent.hasDecided = true
    const { unmount } = render(<GlobalOverlays {...base} user={null} profile={null} />)
    await laisserCharger()
    expect(screen.queryByTestId('accord')).toBeNull()
    unmount()
    render(<GlobalOverlays {...base} user={BOB} profile={{ id: 'u-bob' }} />)
    await laisserCharger()
    expect(screen.queryByTestId('accord')).toBeNull()
  })

  it('cookies pas encore tranchés : la fenêtre attend', async () => {
    mockConsent.hasDecided = false
    render(<GlobalOverlays {...base} user={BOB} profile={{ id: 'u-bob', consent_terms_accepted_at: null }} />)
    await laisserCharger()
    expect(screen.queryByTestId('accord')).toBeNull()
  })
})
