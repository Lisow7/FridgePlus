import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// La communauté ne montre plus une réaction, un « j'aime » ou une suppression
// qui n'a pas eu lieu (audit du 2026-10-04, ARCH-05).
//
// `handleReact` changeait l'écran puis appelait `reactToPost` sans lire
// `{ error }` : une réaction refusée (règle d'accès, hors ligne) restait
// affichée, sans retour arrière. Même défaut, dix lignes plus bas, que
// `handleDelete` avait déjà corrigé. Règle du dépôt (lot 7a) : l'écran annule
// ce qu'il avait affiché, puis le dit (`useSaveErrorToast`).

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => confirmMock }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { id: 'u1', username: 'Moi' } }) }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => 1024 }))
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: () => {} }))
vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: vi.fn() }))
vi.mock('@shared/contexts/data-provider', () => ({ useBaseRecipes: () => ({ recipes: [], recipeNames: {} }) }))
const signaler = vi.hoisted(() => vi.fn())
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

const { POST, AUTRE_POST, REPONSE } = vi.hoisted(() => ({
  POST: {
    id: 'p1', user_id: 'u2', title: 'Un post d’un autre', body: 'Corps.', category: 'general',
    likes_count: 0, replies_count: 1, created_at: new Date().toISOString(),
    profile: { username: 'Autre', avatar_id: null }, recipe_id: null,
  },
  AUTRE_POST: {
    id: 'p2', user_id: 'u1', title: 'Mon propre post', body: 'Corps.', category: 'general',
    likes_count: 0, replies_count: 0, created_at: new Date(Date.now() - 60000).toISOString(),
    profile: { username: 'Moi', avatar_id: null }, recipe_id: null,
  },
  REPONSE: {
    id: 'r1', post_id: 'p1', user_id: 'u1', parent_reply_id: null, body: 'Ma réponse',
    likes_count: 0, created_at: new Date().toISOString(), profile: { username: 'Moi', avatar_id: null },
  },
}))

const api = vi.hoisted(() => ({
  reactToPost: vi.fn(), removePostReaction: vi.fn(), deletePost: vi.fn(), deleteReply: vi.fn(),
  likeReply: vi.fn(), unlikeReply: vi.fn(), listMyPostReactions: vi.fn(),
}))

vi.mock('@shared/api/community', () => ({
  listPosts: vi.fn().mockResolvedValue([POST, AUTRE_POST]),
  getPost: vi.fn().mockResolvedValue(POST),
  createPost: vi.fn(), updatePost: vi.fn(),
  deletePost: (...a) => api.deletePost(...a),
  listReplies: vi.fn().mockResolvedValue([REPONSE]),
  createReply: vi.fn(),
  deleteReply: (...a) => api.deleteReply(...a),
  listMyPostReactions: (...a) => api.listMyPostReactions(...a),
  reactToPost: (...a) => api.reactToPost(...a),
  removePostReaction: (...a) => api.removePostReaction(...a),
  listMyLikedReplyIds: vi.fn().mockResolvedValue(new Set()),
  likeReply: (...a) => api.likeReply(...a),
  unlikeReply: (...a) => api.unlikeReply(...a),
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

const REFUS = { error: 'new row violates row-level security policy' }

async function ouvrir() {
  render(<CommunityPage lang="fr" onClose={vi.fn()} />, { wrapper: MemoryRouter })
  await waitFor(() => screen.getByText('Un post d’un autre'))
}

const boutonReaction = () => screen.getAllByRole('button', { name: /^(Réagir|Retirer ma réaction)$/ })[0]

beforeEach(() => {
  signaler.mockReset()
  confirmMock.mockReset()
  for (const f of Object.values(api)) f.mockReset()
  api.listMyPostReactions.mockResolvedValue(new Map())
  api.reactToPost.mockResolvedValue({ ok: true })
  api.removePostReaction.mockResolvedValue({ ok: true })
  api.deletePost.mockResolvedValue({ ok: true })
  api.deleteReply.mockResolvedValue({ ok: true })
  api.likeReply.mockResolvedValue({ ok: true })
  api.unlikeReply.mockResolvedValue({ ok: true })
})

describe('une réaction refusée est annulée, et dite', () => {
  it('réagir : refusé → l’écran revient à « aucune réaction », compteur compris', async () => {
    api.reactToPost.mockResolvedValue(REFUS)
    await ouvrir()
    fireEvent.click(boutonReaction())
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('reaction'))
    expect(boutonReaction()).toHaveAttribute('aria-label', 'Réagir')
    expect(boutonReaction()).toHaveAttribute('aria-pressed', 'false')
    expect(boutonReaction()).not.toHaveTextContent('1')
  })

  it('réagir : accepté → la réaction reste, rien n’est dit', async () => {
    await ouvrir()
    fireEvent.click(boutonReaction())
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(api.reactToPost).toHaveBeenCalledWith('u1', 'p1', '🔥'))
    expect(boutonReaction()).toHaveAttribute('aria-pressed', 'true')
    expect(boutonReaction()).toHaveTextContent('1')
    expect(signaler).not.toHaveBeenCalled()
  })

  it('retirer sa réaction : refusé → elle revient, compteur compris', async () => {
    api.listMyPostReactions.mockResolvedValue(new Map([['p1', '❤️']]))
    const { listPosts } = await import('@shared/api/community')
    listPosts.mockResolvedValueOnce([{ ...POST, likes_count: 1 }, AUTRE_POST])
    api.removePostReaction.mockResolvedValue(REFUS)
    await ouvrir()
    await waitFor(() => expect(boutonReaction()).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(boutonReaction())
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('reaction'))
    expect(boutonReaction()).toHaveAttribute('aria-pressed', 'true')
    expect(boutonReaction()).toHaveTextContent('❤️')
    expect(boutonReaction()).toHaveTextContent('1')
  })

  it('changer d’émoji : refusé → l’ancien revient, et le compteur n’a jamais bougé', async () => {
    api.listMyPostReactions.mockResolvedValue(new Map([['p1', '❤️']]))
    const { listPosts } = await import('@shared/api/community')
    listPosts.mockResolvedValueOnce([{ ...POST, likes_count: 1 }, AUTRE_POST])
    api.reactToPost.mockResolvedValue(REFUS)
    await ouvrir()
    await waitFor(() => expect(boutonReaction()).toHaveTextContent('❤️'))
    fireEvent.mouseEnter(boutonReaction().closest('div'))
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('reaction'))
    expect(api.reactToPost).toHaveBeenCalledWith('u1', 'p1', '🔥')
    expect(boutonReaction()).toHaveTextContent('❤️')
    expect(boutonReaction()).toHaveTextContent('1')
    expect(boutonReaction()).not.toHaveTextContent('2')
  })

  it('changer d’émoji : accepté → le nouvel émoji, compteur inchangé (une personne, une réaction)', async () => {
    api.listMyPostReactions.mockResolvedValue(new Map([['p1', '❤️']]))
    const { listPosts } = await import('@shared/api/community')
    listPosts.mockResolvedValueOnce([{ ...POST, likes_count: 1 }, AUTRE_POST])
    await ouvrir()
    await waitFor(() => expect(boutonReaction()).toHaveTextContent('❤️'))
    fireEvent.mouseEnter(boutonReaction().closest('div'))
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(boutonReaction()).toHaveTextContent('🔥'))
    expect(boutonReaction()).toHaveTextContent('1')
    expect(boutonReaction()).not.toHaveTextContent('2')
  })

  it('dans le détail d’un post : refusé → le compteur du détail revient aussi', async () => {
    api.reactToPost.mockResolvedValue(REFUS)
    await ouvrir()
    fireEvent.click(screen.getByText('Un post d’un autre'))
    await waitFor(() => screen.getByText('Ma réponse'))
    fireEvent.click(boutonReaction())
    fireEvent.click(await screen.findByTitle('🔥'))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('reaction'))
    expect(boutonReaction()).toHaveAttribute('aria-pressed', 'false')
    expect(boutonReaction()).not.toHaveTextContent('1')
  })
})

describe('une suppression refusée laisse l’élément, et le dit', () => {
  it('supprimer son post : refusé → il reste affiché', async () => {
    confirmMock.mockResolvedValue(true)
    api.deletePost.mockResolvedValue(REFUS)
    await ouvrir()
    fireEvent.click(screen.getByLabelText('Supprimer'))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('removal'))
    expect(screen.getByText('Mon propre post')).toBeInTheDocument()
  })

  it('supprimer sa réponse : refusé → elle reste affichée', async () => {
    confirmMock.mockResolvedValue(true)
    api.deleteReply.mockResolvedValue(REFUS)
    await ouvrir()
    fireEvent.click(screen.getByText('Un post d’un autre'))
    await waitFor(() => screen.getByText('Ma réponse'))
    fireEvent.click(screen.getByLabelText('Supprimer'))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('removal'))
    expect(screen.getByText('Ma réponse')).toBeInTheDocument()
  })

  it('supprimer sa réponse : accepté → elle disparaît', async () => {
    confirmMock.mockResolvedValue(true)
    await ouvrir()
    fireEvent.click(screen.getByText('Un post d’un autre'))
    await waitFor(() => screen.getByText('Ma réponse'))
    fireEvent.click(screen.getByLabelText('Supprimer'))
    await waitFor(() => expect(screen.queryByText('Ma réponse')).not.toBeInTheDocument())
    expect(signaler).not.toHaveBeenCalled()
  })
})

describe('un « j’aime » de réponse refusé est annulé, et dit', () => {
  it('aimer une réponse : refusé → le cœur et le compteur reviennent', async () => {
    api.likeReply.mockResolvedValue(REFUS)
    await ouvrir()
    fireEvent.click(screen.getByText('Un post d’un autre'))
    await waitFor(() => screen.getByText('Ma réponse'))
    const coeur = screen.getByRole('button', { name: 'Aimer cette réponse' })
    fireEvent.click(coeur)
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('reaction'))
    expect(screen.getByRole('button', { name: 'Aimer cette réponse' })).toHaveAttribute('aria-pressed', 'false')
  })
})

