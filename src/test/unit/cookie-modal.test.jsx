import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Chantier I (2026-07-09) : la catégorie « Photo du ticket » (ex-« Scan ticket de caisse ») doit être
// révocable au même titre que la reconnaissance vocale (RGPD art. 7-3, droit
// de retrait aussi simple que l'octroi) — gatée par le flag `receipt_scan`
// pour ne pas exposer un réglage sur une fonctionnalité pas encore lancée.

const mockState = vi.hoisted(() => ({
  flag: false,
  consent: { errors: false, usage: false, voice: false, receiptScan: false },
  push: { available: false },
  save: null,
}))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => mockState.flag }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => mockState.push }))
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: mockState.consent, save: mockState.save }),
}))

import CookieModal from '@features/legal/components/cookie-modal'

beforeEach(() => {
  mockState.flag = false
  mockState.consent = { errors: false, usage: false, voice: false, receiptScan: false }
  mockState.push = { available: false }
  mockState.save = vi.fn()
})

// Décision du 2026-10-06, choix d'Antoine (« bandeau = deux_cases ») : la
// case « Mesure d'audience » se disait anonyme et couvrait deux outils ; elle
// se dédouble. « Fonctionnels », qui ne commandait rien, disparaît.
describe('CookieModal — deux cases, qui disent vrai', () => {
  it('« Rapports d’erreurs » et « Statistiques d’usage » ; plus de « Fonctionnels » ni de « Mesure d’audience »', () => {
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.getByRole('switch', { name: /Rapports d'erreurs/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Statistiques d'usage/ })).toBeInTheDocument()
    expect(screen.queryByText(/Fonctionnels/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mesure d'audience/)).not.toBeInTheDocument()
    expect(screen.queryByText(/[Aa]nonymis/)).not.toBeInTheDocument()
  })

  it('chaque case dit ce qui part, à qui, et combien de temps', async () => {
    const user = userEvent.setup()
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    await user.click(screen.getByText("🔵 Rapports d'erreurs"))
    expect(screen.getByText(/rattachées à l'identifiant de ton compte, jamais à ton adresse e-mail/)).toBeInTheDocument()
    await user.click(screen.getByText("🟣 Statistiques d'usage"))
    expect(screen.getByText('⏱ 13 mois')).toBeInTheDocument()
  })

  it('« Enregistrer mes choix » écrit les deux cases, et rien d’autre que les quatre choix', async () => {
    const user = userEvent.setup()
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    await user.click(screen.getByRole('switch', { name: /Rapports d'erreurs/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }))
    expect(mockState.save).toHaveBeenCalledWith({ errors: true, usage: false, voice: false, receiptScan: false })
  })

  it('en anglais aussi', () => {
    render(<CookieModal lang="en" onClose={vi.fn()} />)
    expect(screen.getByRole('switch', { name: /Error reports/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Usage statistics/ })).toBeInTheDocument()
  })
})

describe('CookieModal — catégorie scan ticket de caisse', () => {
  it('absente quand le flag receipt_scan est désactivé', () => {
    mockState.flag = false
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    expect(screen.queryByText(/Photo du ticket/)).not.toBeInTheDocument()
  })

  it('présente et activable quand le flag receipt_scan est actif', async () => {
    mockState.flag = true
    const user = userEvent.setup()
    render(<CookieModal lang="fr" onClose={vi.fn()} />)
    const header = screen.getByText('🧾 Photo du ticket')
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
