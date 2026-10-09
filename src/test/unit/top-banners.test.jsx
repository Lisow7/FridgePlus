import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TopBanners from '@app/components/top-banners'

// Le bandeau d'un lien reçu par e-mail est la SEULE réponse que reçoit la
// personne (lien expiré, ouvert ailleurs, compte restauré) : il doit être
// annoncé par un lecteur d'écran, pas seulement affiché.
describe('TopBanners — bandeau d’un lien e-mail', () => {
  const props = { lang: 'fr', onRestoreBannerDismiss: vi.fn() }

  it('un échec est une alerte', () => {
    render(<TopBanners {...props} restoreBanner={{ ok: false, msg: 'Ce lien a expiré ou a déjà servi.' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Ce lien a expiré ou a déjà servi.')
  })

  it('un succès est un statut', () => {
    render(<TopBanners {...props} restoreBanner={{ ok: true, msg: 'Compte restauré !' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Compte restauré !')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('se ferme à la croix', () => {
    const fermer = vi.fn()
    render(<TopBanners {...props} onRestoreBannerDismiss={fermer} restoreBanner={{ ok: false, msg: 'Lien expiré.' }} />)
    fireEvent.click(screen.getByRole('button', { name: /fermer/i }))
    expect(fermer).toHaveBeenCalledTimes(1)
  })

  it('rien à dire : rien d’affiché', () => {
    const { container } = render(<TopBanners {...props} restoreBanner={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
