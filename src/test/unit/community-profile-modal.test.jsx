import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/hooks/use-focus-trap', () => ({ useFocusTrap: () => {} }))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@shared/api/community', () => ({
  getCommunityProfile: vi.fn().mockResolvedValue({ username: 'Marie_92', community_bio: '' }),
  listUserPublishedRecipes: vi.fn().mockResolvedValue([]),
  isUserBlocked: vi.fn().mockResolvedValue(false),
  blockUser: vi.fn().mockResolvedValue({ error: null }),
  unblockUser: vi.fn().mockResolvedValue({ error: null }),
}))

import CommunityProfileModal from '@features/community/components/community-profile-modal'

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
