import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UIProvider } from '@shared/contexts/ui-provider'

const updateProfile = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ updateProfile }),
}))

import AvatarPickerModal from '@features/profile/components/avatar-picker-modal'
import { AVATAR_CATALOG } from '@shared/lib/avatars'

function renderModal(props) {
  return render(<UIProvider><AvatarPickerModal {...props} /></UIProvider>)
}

describe('AvatarPickerModal', () => {
  beforeEach(() => { updateProfile.mockClear() })

  it('affiche tous les avatars du catalogue', () => {
    renderModal({ currentAvatarId: 'sushi', onClose: vi.fn() })
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(AVATAR_CATALOG.length)
  })

  it('Enregistrer est désactivé tant que l\'avatar courant est sélectionné', () => {
    renderModal({ currentAvatarId: 'sushi', onClose: vi.fn() })
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('sélectionner un autre avatar puis Enregistrer appelle updateProfile et ferme', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal({ currentAvatarId: 'sushi', onClose })

    await user.click(screen.getByRole('radio', { name: 'pizza' }))
    const save = screen.getByRole('button', { name: 'Enregistrer' })
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ avatar_id: 'pizza' }))
    expect(onClose).toHaveBeenCalled()
  })
})
