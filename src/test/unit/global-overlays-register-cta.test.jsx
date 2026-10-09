import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Depuis le 2026-08-27, la bienvenue attend que le consentement soit tranché
// (le bandeau cookies, en z-index 9998, recouvrait son bouton sur mobile —
// cf. global-overlays-sequencement.test.jsx). On amorce donc un visiteur qui
// a déjà répondu, sinon l'écran ne se monte pas et le CTA n'existe pas.
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({
    hasDecided: true, consent: { essential: true },
    accept: vi.fn(), refuse: vi.fn(), save: vi.fn(),
    setVoiceConsent: vi.fn(), setReceiptScanConsent: vi.fn(), reset: vi.fn(),
  }),
}))

vi.mock('@features/onboarding', async (imp) => {
  const actual = await imp()
  return {
    ...actual,
    WelcomeScreen: ({ onAction }) => (
      <button onClick={() => onAction.showRegister()}>register</button>
    ),
  }
})

import GlobalOverlays from '@app/components/global-overlays'

beforeEach(() => { vi.clearAllMocks() })

describe('GlobalOverlays — CTA register (Fix D)', () => {
  it('le CTA register du welcome/tour appelle onSignUp', () => {
    const onSignUp = vi.fn()
    render(
      <GlobalOverlays
        lang="fr"
        welcomeOpen
        onWelcomeClose={() => {}}
        onSignUp={onSignUp}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'register' }))
    expect(onSignUp).toHaveBeenCalledOnce()
  })
})
