import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: { id: 'u1', username: 'Moi' } }),
}))

vi.mock('@shared/hooks/use-window-width', () => ({
  useWindowWidth: () => 1024,
}))

vi.mock('@shared/hooks/use-close-on-back-button', () => ({
  useCloseOnBackButton: () => {},
}))

vi.mock('@shared/hooks/use-moderation', () => ({
  moderateContent: vi.fn(),
}))

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipes: [], recipeNames: {} }),
}))

vi.mock('@shared/hooks/use-save-error-toast', () => ({
  useSaveErrorToast: () => vi.fn(),
}))

const { mockPost, mockReply } = vi.hoisted(() => ({
  mockPost: {
    id: 'p1',
    user_id: 'u1',
    title: 'Mon poste de test communauté',
    body: 'Corps du post de test.',
    category: 'general',
    likes_count: 0,
    replies_count: 1,
    created_at: new Date().toISOString(),
    profile: { username: 'Moi', avatar_id: null },
    recipe_id: null,
  },
  mockReply: {
    id: 'r1',
    post_id: 'p1',
    user_id: 'u1',
    parent_reply_id: null,
    body: 'Une réponse à supprimer',
    likes_count: 0,
    created_at: new Date().toISOString(),
    profile: { username: 'Moi', avatar_id: null },
  },
}))

vi.mock('@shared/api/community', () => ({
  listPosts: vi.fn().mockResolvedValue([mockPost]),
  getPost: vi.fn().mockResolvedValue(mockPost),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn().mockResolvedValue({}),
  listReplies: vi.fn().mockResolvedValue([mockReply]),
  createReply: vi.fn(),
  deleteReply: vi.fn().mockResolvedValue({}),
  listMyPostReactions: vi.fn().mockResolvedValue(new Map()),
  reactToPost: vi.fn(),
  removePostReaction: vi.fn(),
  listMyLikedReplyIds: vi.fn().mockResolvedValue(new Set()),
  likeReply: vi.fn(),
  unlikeReply: vi.fn(),
  canPost: vi.fn().mockResolvedValue(true),
  canReply: vi.fn().mockResolvedValue(true),
  getMyMuteStatus: vi.fn().mockResolvedValue({ muted: false, until: null }),
  getCommunityTermsAcceptedAt: vi.fn().mockResolvedValue(new Date().toISOString()),
  acceptCommunityTerms: vi.fn(),
  listMyBlockedUserIds: vi.fn().mockResolvedValue(new Set()),
  listAttachableRecipes: vi.fn().mockResolvedValue([]),
  getRecipeNamesByIds: vi.fn().mockResolvedValue(new Map()),
}))

import CommunityPage from '@features/community/components/community-page'

describe('CommunityPage — suppression via useConfirm()', () => {
  beforeEach(() => { confirmMock.mockReset() })

  it('supprimer un post appelle useConfirm() avec title ET body distincts (danger)', async () => {
    confirmMock.mockResolvedValue(false)
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    fireEvent.click(screen.getByLabelText('Supprimer'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer ce post ?',
      body: 'Tu pourras le restaurer dans les 24 h depuis tes posts.',
      danger: true,
    })))
  })

  it('supprimer une réponse appelle useConfirm() avec title seul, sans body (danger)', async () => {
    confirmMock.mockResolvedValue(false)
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    fireEvent.click(screen.getByText('Mon poste de test communauté')) // ouvre la vue détail
    await waitFor(() => screen.getByText('Une réponse à supprimer'))
    fireEvent.click(screen.getByLabelText('Supprimer'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Supprimer ce post ?', // deleteConfirmTitle est réutilisé tel quel (cf. implémentation)
      danger: true,
    })))
    expect(confirmMock.mock.calls[0][0].body).toBeUndefined()
  })
})

describe('CommunityPage — picker de réaction emoji (investigation systematic-debugging)', () => {
  it('le survol (mouseEnter) du bouton "Réagir" ouvre le picker à 5 emojis', async () => {
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    const trigger = screen.getByLabelText('Réagir')
    expect(screen.queryByTitle('❤️')).not.toBeInTheDocument()
    fireEvent.mouseEnter(trigger.closest('div'))
    expect(await screen.findByTitle('❤️')).toBeInTheDocument()
    expect(screen.getByTitle('😋')).toBeInTheDocument()
    expect(screen.getByTitle('🔥')).toBeInTheDocument()
    expect(screen.getByTitle('😮')).toBeInTheDocument()
    expect(screen.getByTitle('👏')).toBeInTheDocument()
  })

  it('le clic sur le bouton "Réagir" ouvre aussi le picker (sans dépendre du hover)', async () => {
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    fireEvent.click(screen.getByLabelText('Réagir'))
    expect(await screen.findByTitle('❤️')).toBeInTheDocument()
  })

  it('cliquer un emoji du picker appelle onReact et referme le picker', async () => {
    const { reactToPost } = await import('@shared/api/community')
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    fireEvent.click(screen.getByLabelText('Réagir'))
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(reactToPost).toHaveBeenCalledWith('u1', 'p1', '🔥'))
    expect(screen.queryByTitle('❤️')).not.toBeInTheDocument()
  })

  it('charte communauté jamais acceptée : bouton "Réagir" désactivé ET explique pourquoi (gate légitime, pas un bug du picker)', async () => {
    const { getCommunityTermsAcceptedAt } = await import('@shared/api/community')
    getCommunityTermsAcceptedAt.mockResolvedValueOnce(null)
    localStorage.removeItem('fridge-community-charter-dismissed')
    render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
    await waitFor(() => screen.getByText('Mon poste de test communauté'))
    // La modale charte s'ouvre automatiquement (canInteract=false tant que
    // non signée) — c'est ELLE qui bloque visuellement l'accès au picker,
    // pas un bug dans EmojiReactionBar. Le bouton explique désormais pourquoi
    // (même pattern que le tooltip du bouton Composer) au lieu de rester
    // muet sur "Réagir".
    const reason = 'Tu peux lire les discussions. Pour publier, liker, répondre ou signaler, tu dois accepter la charte.'
    const trigger = await screen.findByLabelText(reason)
    expect(trigger).toBeDisabled()
    fireEvent.mouseEnter(trigger.closest('div'))
    fireEvent.click(trigger)
    expect(screen.queryByTitle('❤️')).not.toBeInTheDocument()
  })
})
