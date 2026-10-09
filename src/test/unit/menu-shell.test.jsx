import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockWidth = 1200
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => mockWidth }))

import MenuShell from '@shared/ui/menu-shell'

describe('MenuShell', () => {
  it('rend en dialog (bottom sheet) sur mobile', () => {
    mockWidth = 375
    render(<MenuShell open onClose={() => {}} ariaLabel="Menu"><p>contenu</p></MenuShell>)
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  })

  it('rend en menu (dropdown) dès 640', () => {
    mockWidth = 1024
    render(<MenuShell open onClose={() => {}} ariaLabel="Menu" dropPos={{ top: 10, right: 10 }}><p>contenu</p></MenuShell>)
    expect(screen.getByRole('menu', { name: 'Menu' })).toBeInTheDocument()
  })

  it('ne rend rien si fermé', () => {
    mockWidth = 375
    render(<MenuShell open={false} onClose={() => {}} ariaLabel="Menu"><p>contenu</p></MenuShell>)
    expect(screen.queryByText('contenu')).toBeNull()
  })

  // Sur mobile, cette coque se déclare `aria-modal="true"` : elle retire le
  // reste de la page de l'arbre d'accessibilité et se pose en feuille ancrée
  // au bas de l'écran. Elle doit alors se comporter comme une modale pour le
  // geste retour Android — sinon il traverse et quitte la page, le menu restant
  // affiché par-dessus la précédente.
  //
  // Le piège de focus et Escape sont bien couverts, eux, par `useDropdownMenu`
  // côté appelant (les trois consommateurs réels — UserMenu, GuestMenu,
  // FridgeFab — passent tous par lui). Seul le retour manquait.
  describe('geste retour Android', () => {
    it('ferme la feuille mobile au lieu de quitter la page', () => {
      mockWidth = 375
      const onClose = vi.fn()
      render(<MenuShell open onClose={onClose} ariaLabel="Menu"><p>contenu</p></MenuShell>)
      // Un vrai « retour » quitte d'abord l'entrée poussée (cf. use-close-on-back-button)
      window.history.replaceState(null, '')
      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('ne capture PAS le retour en dropdown desktop', () => {
      mockWidth = 1024
      const onClose = vi.fn()
      render(
        <MenuShell open onClose={onClose} ariaLabel="Menu" dropPos={{ top: 10, right: 10 }}>
          <p>contenu</p>
        </MenuShell>
      )
      // Un dropdown n'est pas modal : intercepter le retour navigateur y serait
      // une surprise (l'utilisateur veut revenir en arrière, pas fermer un menu).
      window.history.replaceState(null, '')
      window.dispatchEvent(new PopStateEvent('popstate'))
      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
