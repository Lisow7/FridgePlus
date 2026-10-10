import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import QuickRateToast from '@features/recipes/components/quick-rate-toast'
import ReceiptScanOverlays from '@app/components/receipt-scan-overlays'
import TopBanners from '@app/components/top-banners'

// WCAG 2.2, 2.5.8 « Taille de la cible (minimum) » : 24 × 24 px (audit du
// 2026-10-04, A11Y-13). `<Button>` porte désormais `min-h-6 min-w-6`
// (button.test.jsx) ; restaient quatre `<button>` bruts, mesurés sous 24 px :
// les étoiles de la notation rapide (22 × 22) et sa croix (20 × 20), la croix
// d'erreur du scan de ticket (13 × 16), la croix du bandeau d'essai (17 × 20).
// Ils reçoivent la même taille minimale, en style, puisqu'ils n'ont pas de classes.

const CIBLE_DE_24_PX = { minWidth: '24px', minHeight: '24px' }

describe('les boutons bruts font au moins 24 × 24 px', () => {
  it('notation rapide : les cinq étoiles et la croix', () => {
    render(<QuickRateToast lang="fr" onRate={vi.fn()} onDismiss={vi.fn()} />)
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('button', { name: `${n}/5` })).toHaveStyle(CIBLE_DE_24_PX)
    }
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveStyle(CIBLE_DE_24_PX)
  })

  it('scan de ticket : la croix du message d’erreur', () => {
    render(<ReceiptScanOverlays lang="fr" receiptScanStage="error" receiptScanError="scan_failed" onDismissError={vi.fn()} />)
    expect(screen.getByText('✕')).toHaveStyle(CIBLE_DE_24_PX)
  })

  it('scan de ticket : « Fermer » sous l’écran de connexion requise (13 px de texte, sans marge)', () => {
    render(<ReceiptScanOverlays lang="fr" receiptScanStage="login-required" onLoginRequiredClose={vi.fn()} onShowAuth={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveStyle(CIBLE_DE_24_PX)
  })

  it('bandeau d’essai Premium : « Activer » et la croix', () => {
    render(<TopBanners showTrialBanner trialDaysLeft={3} onTrialActivate={vi.fn()} onTrialDismiss={vi.fn()} lang="fr" />)
    expect(screen.getByRole('button', { name: 'Activer' })).toHaveStyle(CIBLE_DE_24_PX)
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveStyle(CIBLE_DE_24_PX)
  })
})
