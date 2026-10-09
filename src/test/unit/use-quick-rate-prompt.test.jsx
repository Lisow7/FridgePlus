import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const show = vi.fn()
const dismiss = vi.fn()
vi.mock('@shared/ui/toast/toast-provider', () => ({ useToast: () => ({ show, dismiss }) }))

const { mockGetMyReview, mockUpsert } = vi.hoisted(() => ({
  mockGetMyReview: vi.fn(),
  mockUpsert: vi.fn(),
}))
vi.mock('@features/recipes/api/recipe-reviews', () => ({
  getMyReview: (...args) => mockGetMyReview(...args),
  upsertReview: (...args) => mockUpsert(...args),
}))

import { useQuickRatePrompt } from '@features/recipes/hooks/use-quick-rate-prompt'

beforeEach(() => {
  show.mockReset(); dismiss.mockReset()
  mockGetMyReview.mockReset(); mockUpsert.mockReset()
})

describe('useQuickRatePrompt', () => {
  it('utilisateur sans avis existant : affiche le toast de notation', async () => {
    mockGetMyReview.mockResolvedValue(null)
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    expect(show).toHaveBeenCalledTimes(1)
    expect(show.mock.calls[0][1]).toMatchObject({ id: 'quick-rate-r1', duration: 0 })
  })

  it('utilisateur ayant déjà un avis : n\'affiche rien (pas de sursollicitation)', async () => {
    mockGetMyReview.mockResolvedValue({ id: 'rev1', rating: 4 })
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    expect(show).not.toHaveBeenCalled()
  })

  it('userId absent : no-op, aucun fetch', async () => {
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current(null, { recipeId: 'r1', recipeSource: 'base' })
    expect(mockGetMyReview).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
  })

  it('erreur sur getMyReview : n\'affiche rien (ne casse jamais le flux de cuisson)', async () => {
    mockGetMyReview.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useQuickRatePrompt())
    await expect(result.current('u1', { recipeId: 'r1', recipeSource: 'base' })).resolves.toBeUndefined()
    expect(show).not.toHaveBeenCalled()
  })

  it('tap sur une étoile (via le contenu passé à show) : upsertReview(body:null) puis dismiss', async () => {
    mockGetMyReview.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ data: { id: 'rev1', rating: 5 } })
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    const toastContent = show.mock.calls[0][0]
    // toastContent est le <QuickRateToast onRate={...} .../> — on invoque directement sa prop
    await toastContent.props.onRate(5)
    expect(mockUpsert).toHaveBeenCalledWith('u1', { recipeId: 'r1', recipeSource: 'base', rating: 5, body: null })
    expect(dismiss).toHaveBeenCalledWith('quick-rate-r1')
  })
})
