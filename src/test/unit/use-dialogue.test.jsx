import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useDialogue } from '@shared/hooks/use-dialogue'

// Une surcouche équipée par useDialogue se comporte en boîte de dialogue
// (audit du 2026-10-04, A11Y-01) : rôle et nom, focus dedans, Échap qui ferme,
// focus rendu au déclencheur.

function Fenetre({ onClose, nom }) {
  const dialogue = useDialogue({ onClose, nom })
  return (
    <div {...dialogue.proprietes}>
      {!nom && <h3 id={dialogue.titreId}>Supprimer ton compte ?</h3>}
      <button type="button">Annuler</button>
      <button type="button">Confirmer</button>
    </div>
  )
}

function Page() {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOuverte(true)}>Ouvrir</button>
      {ouverte && <Fenetre onClose={() => setOuverte(false)} />}
    </>
  )
}

describe('useDialogue', () => {
  it('rôle de dialogue modal, nommé par son titre', () => {
    render(<Fenetre onClose={() => {}} />)
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ton compte ?' })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
  })

  it('sans titre visible, nommé par son libellé', () => {
    render(<Fenetre onClose={() => {}} nom="Confirmation" />)
    expect(screen.getByRole('dialog', { name: 'Confirmation' })).toBeInTheDocument()
  })

  it('le focus va dans la fenêtre à l’ouverture', () => {
    render(<Fenetre onClose={() => {}} />)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('Échap ferme', () => {
    const onClose = vi.fn()
    render(<Fenetre onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('à la fermeture, le focus revient au déclencheur', async () => {
    render(<Page />)
    const ouvrir = screen.getByRole('button', { name: 'Ouvrir' })
    ouvrir.focus()
    fireEvent.click(ouvrir)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ouvrir)
  })
})
