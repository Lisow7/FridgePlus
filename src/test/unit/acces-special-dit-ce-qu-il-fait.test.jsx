import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SpecialAccessModal from '@features/admin/components/modals/special-access-modal'

// Audit du 2026-10-04, ADM-13 : « Accorder » ne disait pas ce qu'il engage
// (Premium offert sans échéance), un double clic envoyait deux demandes et
// deux lignes de journal, un échec laissait la fenêtre ouverte sans un mot, et
// pour changer de rôle ou de note il fallait révoquer puis réattribuer.

const enAttente = () => new Promise(() => {})

describe('accès spécial — accorder', () => {
  it('dit ce que l’accès engage', () => {
    render(<SpecialAccessModal username="alice" currentRole={null} onConfirmGrant={vi.fn()} onConfirmRevoke={vi.fn()} onCancel={vi.fn()} lireLaNote={vi.fn()} />)
    expect(screen.getByText(/alice aura le Premium offert, sans échéance, jusqu'à ce que tu retires l'accès\./)).toBeInTheDocument()
  })

  it('un double clic n’envoie qu’une demande', async () => {
    const accorder = vi.fn(enAttente)
    render(<SpecialAccessModal username="alice" currentRole={null} onConfirmGrant={accorder} onConfirmRevoke={vi.fn()} onCancel={vi.fn()} lireLaNote={vi.fn()} />)
    const bouton = screen.getByRole('button', { name: /Accorder/ })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    await waitFor(() => expect(bouton).toBeDisabled())
    expect(accorder).toHaveBeenCalledTimes(1)
  })

  it('un refus est dit dans la fenêtre, qui reste ouverte', async () => {
    const accorder = vi.fn().mockResolvedValue({ error: { message: 'unauthorized' } })
    render(<SpecialAccessModal username="alice" currentRole={null} onConfirmGrant={accorder} onConfirmRevoke={vi.fn()} onCancel={vi.fn()} lireLaNote={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Accorder/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec : unauthorized')
    expect(screen.getByRole('button', { name: /Accorder/ })).not.toBeDisabled()
  })
})

describe('accès spécial — déjà accordé', () => {
  it('« Modifier » reprend le rôle et la note actuels, et enregistre sans révoquer', async () => {
    const accorder = vi.fn().mockResolvedValue({ error: null })
    const retirer = vi.fn()
    const lireLaNote = vi.fn().mockResolvedValue({ note: 'Deal Instagram, mai 2026', error: null })
    render(<SpecialAccessModal username="bob" currentRole="influencer" onConfirmGrant={accorder} onConfirmRevoke={retirer} onCancel={vi.fn()} lireLaNote={lireLaNote} />)
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le rôle ou la note' }))
    expect(await screen.findByDisplayValue('Deal Instagram, mai 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Créateur partenaire/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Partenaire Fridge\+/ }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
    await waitFor(() => expect(accorder).toHaveBeenCalledWith('partner', 'Deal Instagram, mai 2026'))
    expect(retirer).not.toHaveBeenCalled()
  })

  it('révoquer : un double clic n’envoie qu’une demande, et un refus est dit', async () => {
    const retirer = vi.fn().mockResolvedValue({ error: { message: 'self_revoke_forbidden' } })
    render(<SpecialAccessModal username="bob" currentRole="tester" onConfirmGrant={vi.fn()} onConfirmRevoke={retirer} onCancel={vi.fn()} lireLaNote={vi.fn()} />)
    const bouton = screen.getByRole('button', { name: /Révoquer/ })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(await screen.findByRole('alert')).toHaveTextContent('Échec : self_revoke_forbidden')
    expect(retirer).toHaveBeenCalledTimes(1)
  })
})
