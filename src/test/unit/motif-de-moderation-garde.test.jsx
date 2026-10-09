import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ConfirmProvider } from '@shared/ui/confirm-dialog/confirm-provider'
import ModerationReasonModal from '@features/admin/components/sections/moderation-reason-modal'

// Audit du 2026-10-04, ADM-18 : le fond de la fenêtre du motif fermait au
// premier clic et perdait le motif — aussi après un cliquer-glisser commencé
// dans le champ et relâché hors de la carte.

const T = { rejected: 'Rejetée', confirmCancel: 'Annuler', moderationModalConfirm: 'Rejeter' }
const COULEURS = { rejected: { bg: '#fee', color: '#c00' }, pending: { bg: '#ffe', color: '#a80' } }

function monter({ onCancel = vi.fn(), onConfirm = vi.fn() } = {}) {
  render(
    <UIProvider><ConfirmProvider>
      <ModerationReasonModal target={{ status: 'rejected', recipeName: 'Tarte' }} lang="fr" t={T} statusColors={COULEURS} onCancel={onCancel} onConfirm={onConfirm} />
    </ConfirmProvider></UIProvider>,
  )
  return { onCancel, onConfirm, fenetre: screen.getAllByRole('dialog')[0] }
}

beforeEach(() => localStorage.setItem('fridge-lang', 'fr'))

describe('motif de modération — il ne se perd pas sur un clic', () => {
  it('sans motif, « Annuler » ferme tout de suite', () => {
    const { onCancel } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('avec un motif écrit, « Annuler » demande d’abord ; « Continuer » le garde', async () => {
    const { onCancel } = monter()
    fireEvent.change(screen.getByLabelText('Précisions (facultatif)'), { target: { value: 'Recette copiée' } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Abandonner ce motif ?' })).getByRole('button', { name: 'Continuer' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Abandonner ce motif ?' })).not.toBeInTheDocument())
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Précisions (facultatif)')).toHaveValue('Recette copiée')
  })

  it('un cliquer-glisser commencé dans le champ et relâché sur le fond ne ferme pas', () => {
    const { onCancel, fenetre } = monter()
    fireEvent.mouseDown(screen.getByLabelText('Précisions (facultatif)'))
    fireEvent.click(fenetre.parentElement)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
