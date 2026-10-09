// La modale d'abonnement n'est chargée qu'à son ouverture (audit du
// 2026-10-04, PERF-07). Montée fermée sur chaque page, elle faisait
// télécharger son fichier ET Stripe à chaque visite (vus à 0,72 s sur
// l'accueil, 0,61 s sur la FAQ), alors que presque personne ne l'ouvre.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const chargee = vi.hoisted(() => ({ fois: 0 }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({
    hasDecided: true,
    consent: { essential: true },
    accept: vi.fn(), refuse: vi.fn(), save: vi.fn(),
    setVoiceConsent: vi.fn(), setReceiptScanConsent: vi.fn(), reset: vi.fn(),
  }),
}))
vi.mock('@features/onboarding', () => ({ WelcomeScreen: () => null }))
vi.mock('@features/pwa/components/update-prompt', () => ({ default: () => null }))
vi.mock('@features/premium/components/upgrade-modal', () => {
  chargee.fois++
  return { default: ({ isOpen }) => (isOpen ? <div role="dialog" aria-label="Premium">Premium</div> : null) }
})

import GlobalOverlays from '@app/components/global-overlays'

const props = { welcomeOpen: false, onWelcomeClose: vi.fn(), onUpgradeClose: vi.fn(), lang: 'fr', darkMode: false }

describe('GlobalOverlays — modale d’abonnement à la demande', () => {
  beforeEach(() => { chargee.fois = 0 })

  it('fermée : son fichier n’est pas demandé', async () => {
    render(<GlobalOverlays {...props} isUpgradeOpen={false} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(chargee.fois).toBe(0)
  })

  it('ouverte : elle se charge et s’affiche', async () => {
    render(<GlobalOverlays {...props} isUpgradeOpen />)
    expect(await screen.findByRole('dialog', { name: 'Premium' })).toBeInTheDocument()
    expect(chargee.fois).toBe(1)
  })
})
