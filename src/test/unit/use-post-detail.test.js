// Tests unit — usePostDetail, état de la vue détail d'un post communauté
// extrait de community-page.jsx (audit front §2) : chargement (post + réponses
// + likes), likes de réponses, réaction au post, envoi et suppression d'une
// réponse. API, confirm et filtre anti-grossièretés mockés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => confirmMock }))
vi.mock('@shared/lib/moderation', () => ({ containsProfanity: vi.fn(() => false) }))
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => vi.fn() }))

const post = { id: 'p1', title: 'Mon post', likes_count: 2, category: 'general' }
const reply = { id: 'r1', post_id: 'p1', user_id: 'u2', body: 'Une réponse', likes_count: 1 }

vi.mock('@shared/api/community', () => ({
  getPost: vi.fn(),
  listReplies: vi.fn(),
  listMyLikedReplyIds: vi.fn(),
  likeReply: vi.fn().mockResolvedValue({}),
  unlikeReply: vi.fn().mockResolvedValue({}),
  createReply: vi.fn(),
  deleteReply: vi.fn().mockResolvedValue({}),
  canReply: vi.fn().mockResolvedValue(true),
}))

import { usePostDetail } from '@features/community/hooks/use-post-detail'
import { getPost, listReplies, listMyLikedReplyIds, likeReply, unlikeReply, createReply, deleteReply, canReply } from '@shared/api/community'
import { containsProfanity } from '@shared/lib/moderation'

const t = {
  profanityWarning: 'Langage inapproprié', spamLimitReply: 'Trop de réponses',
  deleteConfirmTitle: 'Supprimer cette publication ?',
  deleteReplyConfirmTitle: 'Supprimer cette réponse ?',
}
const user = { id: 'u1' }

function setup(overrides = {}) {
  return renderHook(() => usePostDetail({
    postId: 'p1', user, t, canInteract: true,
    reactionsMap: new Map(), onReact: vi.fn(),
    ...overrides,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  getPost.mockResolvedValue(post)
  listReplies.mockResolvedValue([reply])
  listMyLikedReplyIds.mockResolvedValue(new Set())
  canReply.mockResolvedValue(true)
  containsProfanity.mockReturnValue(false)
})

describe('usePostDetail', () => {
  it('charge post, réponses et likes en un seul effet (null avant réponse)', async () => {
    const { result } = setup()
    expect(result.current.post).toBeNull()
    expect(result.current.replies).toBeNull()
    await waitFor(() => expect(result.current.post).toEqual(post))
    expect(result.current.replies).toEqual([reply])
    expect(listMyLikedReplyIds).toHaveBeenCalledWith('u1', 'p1')
  })

  it('invité (sans user) : ne demande pas les likes et garde un Set vide', async () => {
    const { result } = setup({ user: null })
    await waitFor(() => expect(result.current.post).toEqual(post))
    expect(listMyLikedReplyIds).not.toHaveBeenCalled()
    expect(result.current.likedReplyIds.size).toBe(0)
  })

  it('like une réponse : maj optimiste puis appel API, et inverse au second clic', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.replies).toEqual([reply]))

    await act(async () => { await result.current.handleToggleReplyLike('r1') })
    expect(result.current.likedReplyIds.has('r1')).toBe(true)
    expect(result.current.replies[0].likes_count).toBe(2)
    expect(likeReply).toHaveBeenCalledWith('u1', 'r1')

    await act(async () => { await result.current.handleToggleReplyLike('r1') })
    expect(result.current.likedReplyIds.has('r1')).toBe(false)
    expect(result.current.replies[0].likes_count).toBe(1)
    expect(unlikeReply).toHaveBeenCalledWith('u1', 'r1')
  })

  it('like ignoré si canInteract est faux', async () => {
    const { result } = setup({ canInteract: false })
    await waitFor(() => expect(result.current.replies).toEqual([reply]))
    await act(async () => { await result.current.handleToggleReplyLike('r1') })
    expect(likeReply).not.toHaveBeenCalled()
  })

  it('réaction au post : ajuste le compteur en optimiste et remonte onReact', async () => {
    const onReact = vi.fn()
    const { result } = setup({ onReact })
    await waitFor(() => expect(result.current.post).toEqual(post))
    act(() => { result.current.handleReactPost('🔥') })
    expect(result.current.post.likes_count).toBe(3)
    expect(onReact).toHaveBeenCalledWith('p1', '🔥')
  })

  it('envoi d’une réponse : bloque la grossièreté, puis publie et vide le champ', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.post).toEqual(post))

    containsProfanity.mockReturnValue(true)
    act(() => { result.current.setReplyBody('gros mot') })
    await act(async () => { await result.current.handleReplySubmit() })
    expect(result.current.submitError).toBe('Langage inapproprié')
    expect(createReply).not.toHaveBeenCalled()

    containsProfanity.mockReturnValue(false)
    const created = { id: 'r2', body: 'Bien joué' }
    createReply.mockResolvedValue({ data: created, error: null })
    act(() => { result.current.setReplyBody('Bien joué') })
    await act(async () => { await result.current.handleReplySubmit() })
    expect(createReply).toHaveBeenCalledWith('u1', 'p1', 'Bien joué', null)
    expect(result.current.replies).toEqual([reply, created])
    expect(result.current.replyBody).toBe('')
    expect(result.current.submitError).toBeNull()
  })

  it('envoi d’une réponse : quota atteint → message, pas d’appel createReply', async () => {
    canReply.mockResolvedValue(false)
    const { result } = setup()
    await waitFor(() => expect(result.current.post).toEqual(post))
    act(() => { result.current.setReplyBody('Coucou') })
    await act(async () => { await result.current.handleReplySubmit() })
    expect(result.current.submitError).toBe('Trop de réponses')
    expect(createReply).not.toHaveBeenCalled()
  })

  it('suppression d’une réponse : respecte le refus de la confirmation', async () => {
    confirmMock.mockResolvedValue(false)
    const { result } = setup()
    await waitFor(() => expect(result.current.replies).toEqual([reply]))
    await act(async () => { await result.current.handleDeleteReply('r1') })
    // Une réponse n'est pas une publication (lot 13c) : elle reprenait le
    // titre de la publication.
    expect(confirmMock).toHaveBeenCalledWith({ title: 'Supprimer cette réponse ?', danger: true })
    expect(deleteReply).not.toHaveBeenCalled()
    expect(result.current.replies).toEqual([reply])
  })

  it('suppression d’une réponse : confirmée → retirée de la liste', async () => {
    confirmMock.mockResolvedValue(true)
    const { result } = setup()
    await waitFor(() => expect(result.current.replies).toEqual([reply]))
    await act(async () => { await result.current.handleDeleteReply('r1') })
    expect(deleteReply).toHaveBeenCalledWith('r1')
    expect(result.current.replies).toEqual([])
  })
})
