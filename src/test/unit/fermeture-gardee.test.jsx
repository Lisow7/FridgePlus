import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { UIProvider } from '@shared/contexts/ui-provider'
import { ConfirmProvider } from '@shared/ui/confirm-dialog/confirm-provider'
import { useFermetureGardee } from '@shared/hooks/use-fermeture-gardee'

// Audit du 2026-10-04, ADM-18 : un brouillon (annonce, motif de modération) se
// perdait sur un clic — le fond, la croix ou « Annuler » fermaient sans
// prévenir, et un cliquer-glisser commencé dans un champ et relâché hors de la
// carte fermait aussi la fenêtre.

function Fenetre({ onClose }) {
  const [texte, setTexte] = useState('')
  const { fermer, fond } = useFermetureGardee({ onClose, brouillon: texte.trim() !== '' })
  return (
    <div data-testid="fond" {...fond}>
      <div role="dialog" aria-label="Fenêtre">
        <label htmlFor="champ">Texte</label>
        <textarea id="champ" value={texte} onChange={(e) => setTexte(e.target.value)} />
        <button type="button" onClick={fermer}>Annuler</button>
      </div>
    </div>
  )
}

const monter = (onClose) => render(<UIProvider><ConfirmProvider><Fenetre onClose={onClose} /></ConfirmProvider></UIProvider>)

beforeEach(() => localStorage.setItem('fridge-lang', 'fr'))

describe('useFermetureGardee', () => {
  it('sans brouillon, « Annuler » ferme tout de suite', () => {
    const onClose = vi.fn()
    monter(onClose)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('avec un brouillon, fermer demande d’abord ; « Continuer » garde la saisie', async () => {
    const onClose = vi.fn()
    monter(onClose)
    fireEvent.change(screen.getByLabelText('Texte'), { target: { value: 'Maintenance ce soir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    const question = await screen.findByRole('dialog', { name: 'Abandonner ce brouillon ?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Continuer' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Abandonner ce brouillon ?' })).not.toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Texte')).toHaveValue('Maintenance ce soir')
  })

  it('« Abandonner » ferme', async () => {
    const onClose = vi.fn()
    monter(onClose)
    fireEvent.change(screen.getByLabelText('Texte'), { target: { value: 'x' } })
    fireEvent.mouseDown(screen.getByTestId('fond'))
    fireEvent.click(screen.getByTestId('fond'))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Abandonner ce brouillon ?' })).getByRole('button', { name: 'Abandonner' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('un cliquer-glisser commencé dans la carte et relâché sur le fond ne ferme pas', () => {
    const onClose = vi.fn()
    monter(onClose)
    fireEvent.mouseDown(screen.getByLabelText('Texte'))
    fireEvent.click(screen.getByTestId('fond'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('un vrai clic sur le fond (commencé et fini sur lui) ferme, sans brouillon', () => {
    const onClose = vi.fn()
    monter(onClose)
    fireEvent.mouseDown(screen.getByTestId('fond'))
    fireEvent.click(screen.getByTestId('fond'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
