import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// La fenêtre « Bannir » du panneau admin (audit du 2026-10-04, lot 3c-3b :
// CPT-17 ; maquette validée par Antoine le 2026-10-05).
//
// Le bouton « Bannir » écrivait `profiles.banned` seul : pas de motif, pas de
// durée, et la session restait ouverte. La base sait bannir pour de vrai
// (`admin_bannir` : session coupée, reconnexion refusée jusqu'à la date) ; il
// manquait la fenêtre qui choisit le motif — montré à la personne — et la
// durée, avec un bouton qui dit ce qu'il fait.

vi.mock('@shared/hooks/use-dialogue', () => ({
  useDialogue: () => ({ titreId: 'titre-ban', proprietes: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'titre-ban' } }),
}))

import FenetreDeBannissement from '@features/admin/components/modals/fenetre-de-bannissement'

const onBannir = vi.fn()
const onClose = vi.fn()

function monter(props = {}) {
  return render(<FenetreDeBannissement username="pseudo_exemple" darkMode={false} onBannir={onBannir} onClose={onClose} maintenant={new Date('2026-10-05T10:00:00Z')} {...props} />)
}
const motif = () => screen.getByLabelText('Motif, montré à la personne')
const precisions = () => screen.getByLabelText('Précisions')

beforeEach(() => { onBannir.mockReset().mockResolvedValue({ error: null }); onClose.mockReset() })

describe('la fenêtre « Bannir »', () => {
  it('dit qui on bannit', () => {
    monter()
    expect(screen.getByRole('heading', { name: 'Bannir « pseudo_exemple » ?' })).toBeInTheDocument()
  })

  it('le motif est obligatoire : sans lui, rien ne part, et c’est dit', async () => {
    monter()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Bannir 7 jours$/ })) })
    expect(onBannir).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Choisis un motif')
  })

  it('quatre durées ; 7 jours par défaut ; le bouton dit ce qu’il fait', () => {
    monter()
    const durees = screen.getAllByRole('radio').map((r) => r.closest('label').textContent)
    expect(durees).toEqual(['1 jour', '7 jours', '30 jours', 'Sans fin'])
    expect(screen.getByRole('radio', { name: '7 jours' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: '30 jours' }))
    expect(screen.getByRole('button', { name: 'Bannir 30 jours' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Sans fin' }))
    expect(screen.getByRole('button', { name: 'Bannir sans fin' })).toBeInTheDocument()
  })

  it('annonce la date de fin, et ce que le bannissement coupe', () => {
    monter()
    expect(screen.getByText(/reconnexion refusée jusqu’au 12 octobre 2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Sans fin' }))
    expect(screen.getByText(/reconnexion refusée sans date de fin/)).toBeInTheDocument()
  })

  it('précisions : 250 caractères au plus, avec le compte', () => {
    monter()
    fireEvent.change(precisions(), { target: { value: 'Liens publicitaires répétés' } })
    expect(screen.getByText('27 / 250')).toBeInTheDocument()
    expect(precisions()).toHaveAttribute('maxLength', '250')
  })

  it('un texte collé de plus de 250 caractères est tronqué (le plafond ne tient pas qu’au clavier)', () => {
    monter()
    fireEvent.change(precisions(), { target: { value: 'x'.repeat(300) } })
    expect(precisions()).toHaveValue('x'.repeat(250))
    expect(screen.getByText('250 / 250')).toBeInTheDocument()
  })

  it('envoie le motif complet (catégorie — précisions) et la durée en jours', async () => {
    monter()
    fireEvent.change(motif(), { target: { value: 'Spam' } })
    fireEvent.change(precisions(), { target: { value: 'Liens publicitaires répétés' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bannir 7 jours' })) })
    expect(onBannir).toHaveBeenCalledWith({ motif: 'Spam — Liens publicitaires répétés', jours: 7 })
  })

  it('sans précisions : la catégorie seule ; « Sans fin » : aucune durée', async () => {
    monter()
    fireEvent.change(motif(), { target: { value: 'Harcèlement' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Sans fin' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bannir sans fin' })) })
    expect(onBannir).toHaveBeenCalledWith({ motif: 'Harcèlement', jours: null })
  })

  it('la base refuse : c’est dit DANS la fenêtre, qui reste ouverte', async () => {
    onBannir.mockResolvedValue({ error: { message: 'Un admin ne peut pas être banni.' } })
    monter()
    fireEvent.change(motif(), { target: { value: 'Spam' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bannir 7 jours' })) })
    expect(screen.getByRole('alert')).toHaveTextContent('Un admin ne peut pas être banni.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('« Annuler » ferme sans bannir', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onBannir).not.toHaveBeenCalled()
  })
})
