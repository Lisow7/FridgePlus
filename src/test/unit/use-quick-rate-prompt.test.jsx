import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const show = vi.fn()
const dismiss = vi.fn()
vi.mock('@shared/ui/toast/toast-provider', () => ({ useToast: () => ({ show, dismiss }) }))
const signaler = vi.fn()
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

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
  signaler.mockReset()
})

describe('useQuickRatePrompt', () => {
  it('utilisateur sans avis existant : affiche le toast de notation', async () => {
    mockGetMyReview.mockResolvedValue(null)
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    expect(show).toHaveBeenCalledTimes(1)
    // Décision du 2026-10-08 : plus de minuteur (3 s ne laissaient pas le temps
    // de lire et de choisir, WCAG 2.2.1). Il part quand on note, quand on le
    // ferme, ou quand on quitte la fiche (tests plus bas).
    expect(show.mock.calls[0][1]).toEqual({ id: 'quick-rate-r1', duration: 0 })
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

  // Hors audit, trouvé le 2026-10-05 : le résultat de la note était jeté.
  it('la note est refusée par la base : c’est dit', async () => {
    mockGetMyReview.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ error: 'Failed to fetch' })
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    await show.mock.calls[0][0].props.onRate(4)
    expect(signaler).toHaveBeenCalledWith('rating')
  })

  it('la note est acceptée : rien n’est dit (témoin)', async () => {
    mockGetMyReview.mockResolvedValue(null)
    mockUpsert.mockResolvedValue({ data: { id: 'rev1', rating: 4 } })
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    await show.mock.calls[0][0].props.onRate(4)
    expect(signaler).not.toHaveBeenCalled()
  })

  it('une note qui lève (réseau coupé) : dite aussi, sans exception', async () => {
    mockGetMyReview.mockResolvedValue(null)
    mockUpsert.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useQuickRatePrompt())
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base', lang: 'fr' })
    await show.mock.calls[0][0].props.onRate(4)
    expect(signaler).toHaveBeenCalledWith('rating')
  })

  it('quitter la fiche retire le toast affiché', async () => {
    mockGetMyReview.mockResolvedValue(null)
    const { result, unmount } = renderHook(() => useQuickRatePrompt('r1'))
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base' })
    unmount()
    expect(dismiss).toHaveBeenCalledWith('quick-rate-r1')
  })

  it('changer de recette dans la même fiche retire le toast de la précédente', async () => {
    mockGetMyReview.mockResolvedValue(null)
    const { result, rerender } = renderHook(({ id }) => useQuickRatePrompt(id), { initialProps: { id: 'r1' } })
    await result.current('u1', { recipeId: 'r1', recipeSource: 'base' })
    rerender({ id: 'r2' })
    expect(dismiss).toHaveBeenCalledWith('quick-rate-r1')
  })

  it("fiche quittée pendant la lecture de l'avis : le toast ne s'affiche pas après coup", async () => {
    let resoudre
    mockGetMyReview.mockReturnValue(new Promise((r) => { resoudre = r }))
    const { result, unmount } = renderHook(() => useQuickRatePrompt('r1'))
    const appel = result.current('u1', { recipeId: 'r1', recipeSource: 'base' })
    unmount()
    resoudre(null)
    await appel
    expect(show).not.toHaveBeenCalled()
  })
})
