import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-focus-trap', () => ({ useFocusTrap: () => {} }))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@shared/api/community', () => ({
  getCommunityProfile: vi.fn().mockResolvedValue({ profile: { username: 'Marie_92', community_bio: '' }, error: null }),
  listUserPublishedRecipes: vi.fn().mockResolvedValue([]),
  isUserBlocked: vi.fn().mockResolvedValue(false),
  blockUser: vi.fn().mockResolvedValue({ error: null }),
  unblockUser: vi.fn().mockResolvedValue({ error: null }),
}))

import CommunityProfileModal from '@features/community/components/community-profile-modal'
import { getCommunityProfile } from '@shared/api/community'

describe('CommunityProfileModal — bloquer un profil (imbriqué)', () => {
  it('demande confirmation via useConfirm() (neutre, pas danger) avant de bloquer', async () => {
    confirmMock.mockResolvedValue(true)
    render(<CommunityProfileModal userId="u2" currentUserId="u1" lang="fr" onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Marie_92'))
    fireEvent.click(screen.getByText(/Bloquer/i))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Bloquer Marie_92 ? Tu ne verras plus ses posts ni ses réponses dans la communauté. Tu peux le débloquer à tout moment depuis son profil.',
    })))
    const call = confirmMock.mock.calls[0][0]
    expect(call.danger).not.toBe(true)
  })
})

// Audit du 2026-10-04 (BDD-13) : lue dans `profiles`, la fiche d'un autre compte
// était toujours « Profil introuvable ». Elle passe par la fonction publique de
// la base — et une lecture ratée ne doit pas se faire passer pour un compte
// disparu (lot 7).
describe('CommunityProfileModal — fiche pas chargée', () => {
  const ouvrir = () => render(<CommunityProfileModal userId="u2" currentUserId="u1" lang="fr" onClose={vi.fn()} />)

  it('la lecture échoue : le dit et propose de réessayer — pas « Profil introuvable »', async () => {
    getCommunityProfile.mockResolvedValueOnce({ profile: null, error: { message: 'Failed to fetch' } })
    ouvrir()
    expect(await screen.findByRole('alert')).toHaveTextContent("Le profil n'a pas pu être chargé.")
    expect(screen.queryByText('Profil introuvable.')).toBeNull()
  })

  it('« Réessayer » relit la fiche, qui s’affiche', async () => {
    getCommunityProfile.mockResolvedValueOnce({ profile: null, error: { message: 'Failed to fetch' } })
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Marie_92')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('témoin — compte disparu : « Profil introuvable. »', async () => {
    getCommunityProfile.mockResolvedValueOnce({ profile: null, error: null })
    ouvrir()
    expect(await screen.findByText('Profil introuvable.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
