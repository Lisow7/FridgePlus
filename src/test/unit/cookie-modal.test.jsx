import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Chantier I (2026-07-09) : la catégorie « Scan ticket de caisse » doit être
// révocable au même titre que la reconnaissance vocale (RGPD art. 7-3, droit
// de retrait aussi simple que l'octroi) — gatée par le flag `receipt_scan`
// pour ne pas exposer un réglage sur une fonctionnalité pas encore lancée.

const mockState = vi.hoisted(() => ({
  flag: false,
  consent: { functional: false, audience: false, voice: false, receiptScan: false },
  push: { available: false },
}))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => mockState.flag }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => mockState.push }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: mockState.consent, save: vi.fn() }),
}))

import CookieModal from '@features/legal/components/cookie-modal'

beforeEach(() => {
  mockState.flag = false
  mockState.consent = { functional: false, audience: false, voice: false, receiptScan: false }
  mockState.push = { available: false }
})

describe('CookieModal — catégorie scan ticket de caisse', () => {
  it('absente quand le flag receipt_scan est désactivé', () => {
    mockState.flag = false
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.queryByText(/Scan ticket de caisse/)).not.toBeInTheDocument()
  })

  it('présente et activable quand le flag receipt_scan est actif', async () => {
    mockState.flag = true
    const user = userEvent.setup()
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    const header = screen.getByText('🧾 Scan ticket de caisse')
    expect(header).toBeInTheDocument()
    await user.click(header)
    expect(screen.getByText(/Destinataire de la photo/)).toBeInTheDocument()
  })
})

describe('CookieModal — catégorie push en erreur', () => {
  it('affiche le message d\'échec sans que l\'utilisateur ait besoin de déplier la carte', () => {
    mockState.push = { available: true, enabled: false, loading: false, error: true, blocked: false, toggle: vi.fn() }
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.getByText(/Impossible d'activer les notifications sur ce navigateur/)).toBeInTheDocument()
  })
})
