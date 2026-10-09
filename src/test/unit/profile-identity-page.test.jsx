import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))

const outletContextMock = vi.fn()
vi.mock('react-router-dom', () => ({
  useOutletContext: () => outletContextMock(),
}))

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ updateProfile: vi.fn() }) }))

const useProfileStateMock = vi.fn()
vi.mock('@features/profile/hooks/use-profile-state', () => ({
  useProfileState: () => useProfileStateMock(),
}))

vi.mock('@shared/api/community', () => ({
  acceptCommunityTerms: vi.fn(),
  revokeCommunityTerms: vi.fn().mockResolvedValue({ error: null }),
  updateCommunityBio: vi.fn(),
}))

import ProfileIdentityPage from '@features/profile/pages/profile-identity-page'

describe('ProfileIdentityPage (Sprint 11 S11.a.2)', () => {
  beforeEach(() => {
    outletContextMock.mockReturnValue({
      lang: 'fr', darkMode: false,
      profile: { id: 'u1', username: 'alice', avatar_id: 'a1', community_bio: 'Hello' },
      setAvatarModalOpen: vi.fn(),
    })
    // Charte non signée par défaut pour ces 4 tests (comportement historique).
    useProfileStateMock.mockReturnValue({ communityTermsAt: null, setCommunityTermsAt: vi.fn() })
  })

  it('rend le titre Profil et les 4 sections', () => {
    render(<ProfileIdentityPage />)
    expect(screen.getByRole('heading', { level: 1, name: /profil/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /avatar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /pseudo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /bio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /charte/i })).toBeInTheDocument()
  })

  it('affiche le pseudo dans l\'input', () => {
    render(<ProfileIdentityPage />)
    expect(screen.getByLabelText('Pseudo')).toHaveValue('alice')
  })

  it('affiche la bio existante avec compteur de caractères', () => {
    render(<ProfileIdentityPage />)
    expect(screen.getByText(/5 \/ 280/)).toBeInTheDocument()
  })

  it('le bouton « Accepter la charte » est visible si non acceptée', () => {
    render(<ProfileIdentityPage />)
    expect(screen.getByRole('button', { name: /accepter la charte/i })).toBeInTheDocument()
  })
})

describe('ProfileIdentityPage — révoquer la charte', () => {
  it('appelle useConfirm() (neutre, pas danger) avant de révoquer', async () => {
    outletContextMock.mockReturnValue({
      lang: 'fr', darkMode: false,
      profile: { id: 'u1', username: 'Marie', community_bio: '' },
      setAvatarModalOpen: vi.fn(),
    })
    useProfileStateMock.mockReturnValue({ communityTermsAt: '2026-01-01', setCommunityTermsAt: vi.fn() })
    confirmMock.mockResolvedValue(true)
    render(<ProfileIdentityPage />)
    fireEvent.click(screen.getByText('Révoquer ma signature'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Confirmer la révocation ? Tu ne pourras plus publier dans la communauté.',
    }))
    const call = confirmMock.mock.calls[0][0]
    expect(call.danger).not.toBe(true)
  })
})
