import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'

// Audit du 2026-10-04, lot 9g-3 (A11Y-17) : ce qui changeait à l'écran sans un mot pour
// les lecteurs d'écran — la lecture du ticket (surcouche plein écran sans rôle ni focus),
// son erreur (sans rôle d'alerte, croix sans nom), le nombre de recettes après une
// recherche, et le minuteur du mode cuisine dont « Terminé ! » arrivait dans le même rendu
// que l'allumage de sa région vive (donc jamais annoncé).

vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@features/receipt-scan', () => ({ ReceiptConsentScreen: () => null }))
vi.mock('@features/receipt-scan/components/receipt-review-panel', () => ({ default: () => null }))

import ReceiptScanOverlays from '@app/components/receipt-scan-overlays'
import RecipeResultsCount from '@features/recipes/components/recipe-results-count'
import CookingTimerWidget from '@features/cooking-mode/components/cooking-timer-widget'
import { PANEL_I18N } from '@shared/static/recipe-panel-i18n'

const base = { lang: 'fr', darkMode: false, stock: new Set(), matched: [], ambiguous: [], unmatchedCount: 0, receiptToast: null, receiptReviewOpen: false, receiptScanError: null }

describe('la lecture du ticket se dit', () => {
  it('« Lecture du ticket… » est une région de statut occupée, et prend le focus', () => {
    render(<ReceiptScanOverlays {...base} receiptScanStage="processing" />)
    const statut = screen.getByRole('status')
    expect(statut).toHaveTextContent('Lecture du ticket…')
    expect(statut).toHaveAttribute('aria-busy', 'true')
    expect(document.activeElement).toBe(statut)
  })

  it('une erreur de scan est une alerte, et sa croix a un nom', () => {
    const onDismissError = vi.fn()
    render(<ReceiptScanOverlays {...base} receiptScanStage="error" receiptScanError="scan_failed" onDismissError={onDismissError} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue, réessaie.')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onDismissError).toHaveBeenCalled()
  })

  it('« N ingrédients ajoutés au frigo » est un statut', () => {
    render(<ReceiptScanOverlays {...base} receiptScanStage="idle" receiptToast={{ count: 3 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('3 ingrédients ajoutés au frigo')
  })
})

describe('le nombre de recettes se dit après une recherche ou un filtre', () => {
  it('une région de statut, invisible, qui porte le compte', () => {
    const { rerender } = render(<RecipeResultsCount count={3} t={PANEL_I18N.fr} />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('3 recettes')
    expect(region.className).toMatch(/sr-only/)
    rerender(<RecipeResultsCount count={1} t={PANEL_I18N.fr} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 recette')
  })

  it('le panneau la monte, et ne dit plus « recettes restantes » en français aux anglophones', () => {
    const source = readFileSync('src/features/recipes/components/recipe-panel.jsx', 'utf8')
    expect(source).toMatch(/<RecipeResultsCount\b/)
    expect(source).not.toMatch(/'recettes restantes'/)
    expect(PANEL_I18N.en.remainingCount(2)).toBe('2 more recipes…')
    expect(PANEL_I18N.fr.remainingCount(1)).toBe('1 recette restante…')
  })
})

describe('le minuteur du mode cuisine annonce la fin, et rien d’autre', () => {
  const minuteur = (state) => ({ state, secondsLeft: state === 'done' ? 0 : 65, label: 'Cuisson' })

  it('le compte à rebours visible reste muet (aria-live off) ; une région de statut permanente dit « Terminé ! »', () => {
    const { rerender } = render(<CookingTimerWidget timer={minuteur('running')} lang="fr" />)
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off')
    const statut = screen.getByRole('status')
    expect(statut).toHaveTextContent('')
    rerender(<CookingTimerWidget timer={minuteur('done')} lang="fr" />)
    expect(screen.getByRole('status')).toBe(statut)
    expect(statut).toHaveTextContent('Terminé !')
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off')
  })
})
