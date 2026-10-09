import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UIProvider } from '@shared/contexts/ui-provider'

const updateProfile = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ updateProfile }) }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import BannerPickerModal from '@features/profile/components/banner-picker-modal'
import { BANNER_CATALOG } from '@shared/lib/banners'

function renderModal(props) {
  return render(<UIProvider><BannerPickerModal {...props} /></UIProvider>)
}

describe('BannerPickerModal', () => {
  beforeEach(() => { updateProfile.mockClear() })

  it('affiche toutes les bannières du catalogue', () => {
    renderModal({ currentBannerId: 'ocean', onClose: vi.fn() })
    expect(screen.getAllByRole('radio')).toHaveLength(BANNER_CATALOG.length)
  })

  it('Enregistrer désactivé tant que la bannière courante est sélectionnée', () => {
    renderModal({ currentBannerId: 'ocean', onClose: vi.fn() })
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('sélection + Enregistrer → updateProfile({ banner_id }) puis ferme', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal({ currentBannerId: 'ocean', onClose })
    await user.click(screen.getByRole('radio', { name: 'forest' }))
    const save = screen.getByRole('button', { name: 'Enregistrer' })
    expect(save).toBeEnabled()
    await user.click(save)
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ banner_id: 'forest' }))
    expect(onClose).toHaveBeenCalled()
  })
})
