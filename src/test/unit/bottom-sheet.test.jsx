import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BottomSheet from '@shared/ui/bottom-sheet'

// La coquille qui manquait : 41 boîtes de dialogue dans le dépôt, 6 seulement
// utilisaient celle qui existait — parce qu'elle ne savait pas exprimer une
// feuille ancrée en bas. Chacun a réécrit la sienne, et les défauts se sont
// multipliés avec les copies. Ces tests verrouillent les quatre propriétés
// qu'aucune copie main-roulée n'avait toutes.

const props = { title: 'Partager', closeLabel: 'Fermer', onClose: vi.fn() }

describe('BottomSheet — les quatre propriétés que les copies perdaient', () => {
  it('annonce un dialogue nommé (role, aria-modal, nom accessible)', () => {
    render(<BottomSheet {...props}><p>contenu</p></BottomSheet>)
    const d = screen.getByRole('dialog', { name: 'Partager' })
    expect(d).toHaveAttribute('aria-modal', 'true')
  })

  it('donne un nom accessible au bouton de fermeture (WCAG 4.1.2)', () => {
    // `cart-share-sheet` l'avait perdu : un bouton icône sans nom, invisible
    // pour un lecteur d'écran.
    render(<BottomSheet {...props}><p>contenu</p></BottomSheet>)
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  it('réserve la hauteur du bandeau cookies au lieu de passer dessous', () => {
    // Sans ça, une feuille `bottom: 0` est intégralement recouverte sur mobile
    // — le défaut qui a frappé la production deux fois en deux jours.
    render(<BottomSheet {...props}><p>contenu</p></BottomSheet>)
    const d = screen.getByRole('dialog', { name: 'Partager' })
    expect(d.style.bottom).toBe('var(--fp-bottom-inset, 0px)')
  })

  it('ferme au clic sur le voile et au bouton', () => {
    const onClose = vi.fn()
    const { container } = render(<BottomSheet {...props} onClose={onClose}><p>contenu</p></BottomSheet>)
    fireEvent.click(container.querySelector('[aria-hidden="true"]'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('rend son contenu', () => {
    render(<BottomSheet {...props}><p>mon contenu</p></BottomSheet>)
    expect(screen.getByText('mon contenu')).toBeInTheDocument()
  })
})
