// Le bandeau cookies (fixed, z-index 9998) passe AU-DESSUS de l'écran de
// bienvenue (z-index 1100) : sur mobile il recouvrait son bouton principal et
// le rendait incliquable (mesuré en prod le 2026-08-27 : 81 px masqués sur
// iPhone, 211 px sur petit écran, hit-test négatif). On séquence donc les deux
// surfaces — le consentement d'abord (c'est de toute façon la porte légale),
// la bienvenue ensuite, dégagée.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const mockConsent = vi.hoisted(() => ({ hasDecided: false }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({
    hasDecided: mockConsent.hasDecided,
    consent: { essential: true },
    accept: vi.fn(), refuse: vi.fn(), save: vi.fn(),
    setVoiceConsent: vi.fn(), setReceiptScanConsent: vi.fn(), reset: vi.fn(),
  }),
}))
vi.mock('@features/onboarding/components/welcome-screen', () => ({
  default: () => <div data-testid="welcome">Bienvenue en cuisine !</div>,
}))
vi.mock('@features/pwa/components/update-prompt', () => ({ default: () => null }))
vi.mock('@features/premium/components/upgrade-modal', () => ({ default: () => null }))

import GlobalOverlays from '@app/components/global-overlays'

const props = { welcomeOpen: true, onWelcomeClose: vi.fn(), lang: 'fr', darkMode: false }
// La bienvenue est chargée à la demande (React.lazy) : on laisse ce chargement
// se résoudre avant chaque vérification, présence comme absence.
const laisserCharger = () => act(() => new Promise((r) => setTimeout(r, 0)))

describe('GlobalOverlays — séquencement consentement → bienvenue', () => {
  it('consentement EN ATTENTE : la bienvenue attend (son bouton serait masqué par le bandeau)', async () => {
    mockConsent.hasDecided = false
    render(<GlobalOverlays {...props} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
    // Le bandeau, lui, est bien là : le visiteur a une décision à prendre.
    expect(screen.getByRole('dialog', { name: /cookies/i })).toBeInTheDocument()
  })

  it('consentement DONNÉ : la bienvenue s’affiche, plus rien ne la recouvre', async () => {
    mockConsent.hasDecided = true
    render(<GlobalOverlays {...props} />)
    expect(await screen.findByTestId('welcome')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /cookies/i })).toBeNull()
  })

  it('welcomeOpen=false : rien, quel que soit le consentement', async () => {
    mockConsent.hasDecided = true
    render(<GlobalOverlays {...props} welcomeOpen={false} />)
    await laisserCharger()
    expect(screen.queryByTestId('welcome')).toBeNull()
  })
})
