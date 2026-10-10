import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Les deux sections RGPD s'affichent désormais pour tout compte (audit du
// 2026-10-04, PREM-11). Visibles plus souvent, deux défauts sont sortis de
// l'ombre à la suite de bout en bout : un `<h4>` qui sautait un niveau
// (axe `heading-order`), et un comptage des dépenses lancé dès le montage de
// la page, même section repliée (une requête de plus sur chaque page Compte).

const mockSelect = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: () => ({ select: mockSelect }) },
}))

import EraseSpendingHistorySection from '@features/profile/components/erase-spending-history-section'
import ProfilingOptOutSection from '@features/profile/components/profiling-opt-out-section'

const COMMUN = { lang: 'fr', isMobile: false, darkMode: false, border: '#ccc', textColor: '#000', mutedColor: '#666' }

beforeEach(() => {
  mockSelect.mockReset()
  mockSelect.mockReturnValue({ eq: () => Promise.resolve({ count: 3 }) })
})

describe('Supprimer mon historique de dépenses', () => {
  it('son titre est un <h2>, au niveau des autres sections de la page', () => {
    render(<EraseSpendingHistorySection {...COMMUN} userId="u-1" onErase={vi.fn()} modalBg="#fff" collapsible defaultOpen={false} />)
    expect(screen.getByRole('heading', { level: 2, name: /Supprimer mon historique de dépenses/ })).toBeInTheDocument()
  })

  it('repliée, elle ne compte rien ; dépliée, elle compte une fois', async () => {
    render(<EraseSpendingHistorySection {...COMMUN} userId="u-1" onErase={vi.fn()} modalBg="#fff" collapsible defaultOpen={false} />)
    expect(mockSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Supprimer mon historique de dépenses/ }))
    await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1))
    expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  })

  // Audit du 2026-10-04, lot « accès à la base rangés » (et ADM-08 : un comptage
  // raté n'est pas un zéro) : le comptage refusé laissait 0, et la fenêtre de
  // confirmation affirmait « aucune dépense enregistrée à effacer ».
  it('le comptage échoue : la confirmation ne prétend pas qu’il n’y a rien à supprimer', async () => {
    mockSelect.mockReturnValue({ eq: () => Promise.resolve({ count: null, error: { message: 'boom' } }) })
    render(<EraseSpendingHistorySection {...COMMUN} userId="u-1" onErase={vi.fn()} modalBg="#fff" />)
    await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon historique' }))
    const fenetre = await screen.findByRole('dialog')
    expect(fenetre).not.toHaveTextContent('aucune dépense enregistrée')
    expect(fenetre).toHaveTextContent('Toutes tes dépenses enregistrées seront supprimées définitivement.')
  })

  it('le comptage répond : le nombre est dit (témoin)', async () => {
    render(<EraseSpendingHistorySection {...COMMUN} userId="u-1" onErase={vi.fn()} modalBg="#fff" />)
    await waitFor(() => expect(mockSelect).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon historique' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Toutes tes dépenses enregistrées (3) seront supprimées définitivement.')
  })
})

describe('Opposition au profilage', () => {
  it('son titre est un <h3>, sous la section « Confidentialité » (h2)', () => {
    render(<ProfilingOptOutSection {...COMMUN} optedOut={false} onChange={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 3, name: /Opposition au profilage/ })).toBeInTheDocument()
  })
})
