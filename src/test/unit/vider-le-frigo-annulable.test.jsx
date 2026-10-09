import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockTrigger = vi.hoisted(() => vi.fn())
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: mockTrigger }) }))

import { useViderLeFrigo } from '@features/fridge/hooks/use-vider-le-frigo'

// Audit du 2026-10-04, UX-06 : deux portes vidaient le frigo — le bouton orange
// laissait 10 secondes pour annuler, le « Vider » du panneau des recettes
// supprimait tout d'un coup. Les deux passent par ce hook.

beforeEach(() => mockTrigger.mockReset())

describe('vider le frigo, avec 10 secondes pour annuler', () => {
  it('vide à l’écran tout de suite, puis propose « Annuler » avec le frigo mis de côté', () => {
    const fn = { onEmptyOptimistic: vi.fn(), onEmptyConfirm: vi.fn(), onEmptyUndo: vi.fn() }
    const { result } = renderHook(() => useViderLeFrigo({ stock: new Set(['a', 'b']), lang: 'fr', ...fn }))
    result.current()
    expect(fn.onEmptyOptimistic).toHaveBeenCalledTimes(1)
    expect(mockTrigger).toHaveBeenCalledTimes(1)
    const { label, onConfirm, onUndo } = mockTrigger.mock.calls[0][0]
    expect(label).toBe('Frigo vidé')
    onUndo()
    expect(fn.onEmptyUndo).toHaveBeenCalledWith(new Set(['a', 'b']))
    onConfirm()
    expect(fn.onEmptyConfirm).toHaveBeenCalledWith(new Set(['a', 'b']))
  })

  it('un frigo déjà vide : rien ne se passe', () => {
    const fn = { onEmptyOptimistic: vi.fn(), onEmptyConfirm: vi.fn(), onEmptyUndo: vi.fn() }
    const { result } = renderHook(() => useViderLeFrigo({ stock: new Set(), lang: 'fr', ...fn }))
    result.current()
    expect(fn.onEmptyOptimistic).not.toHaveBeenCalled()
    expect(mockTrigger).not.toHaveBeenCalled()
  })
})
