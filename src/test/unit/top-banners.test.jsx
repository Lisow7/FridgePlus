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

// Un profil qui ne charge pas : le dire, et proposer de relire (audit du
// 2026-10-04, CPT-12). Une alerte : c'est la seule réponse que reçoit la personne.
describe('TopBanners — profil indisponible', () => {
  it('une alerte avec « Réessayer », qui relit le profil', () => {
    const relire = vi.fn()
    render(<TopBanners lang="fr" profilIndisponible onRelancerLeProfil={relire} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/profil/i)
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(relire).toHaveBeenCalledTimes(1)
  })

  it('rien quand le profil va bien', () => {
    const { container } = render(<TopBanners lang="fr" profilIndisponible={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
