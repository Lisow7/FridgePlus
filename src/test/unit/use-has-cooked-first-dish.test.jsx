import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const hasCookedAtLeastOnce = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/cooking-logs', () => ({ hasCookedAtLeastOnce }))

import { useHasCookedFirstDish } from '@features/onboarding/hooks/use-has-cooked-first-dish'

// « On ne sait pas encore » n'est pas « jamais cuisiné » : tant que le serveur
// n'a pas répondu, le crochet rend `null`. Rendre `false` d'emblée faisait
// clignoter la carte du débutant chez un compte ancien (audit P-08).
describe('useHasCookedFirstDish', () => {
  beforeEach(() => { hasCookedAtLeastOnce.mockReset() })

  it('invité : faux, sans rien demander au serveur', () => {
    expect(renderHook(() => useHasCookedFirstDish('guest')).result.current).toBe(false)
    expect(renderHook(() => useHasCookedFirstDish(undefined)).result.current).toBe(false)
    expect(hasCookedAtLeastOnce).not.toHaveBeenCalled()
  })

  it('compte : inconnu (null) tant que le serveur n’a pas répondu, puis sa réponse', async () => {
    let repondre
    hasCookedAtLeastOnce.mockReturnValue(new Promise((resolve) => { repondre = resolve }))
    const { result } = renderHook(() => useHasCookedFirstDish('u1'))
    expect(result.current).toBeNull()
    await act(async () => { repondre(true) })
    expect(result.current).toBe(true)
  })

  it('compte qui n’a jamais cuisiné : faux, une fois la réponse arrivée', async () => {
    hasCookedAtLeastOnce.mockResolvedValue(false)
    const { result } = renderHook(() => useHasCookedFirstDish('u1'))
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('la lecture échoue : on ne sait toujours pas (null) — ce n’est pas « jamais cuisiné »', async () => {
    hasCookedAtLeastOnce.mockResolvedValue(null)
    const { result } = renderHook(() => useHasCookedFirstDish('u1'))
    await act(async () => {})
    expect(result.current).toBeNull()
  })

  it('un appel qui lève (réseau coupé) : on ne sait pas non plus, sans exception', async () => {
    hasCookedAtLeastOnce.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useHasCookedFirstDish('u1'))
    await act(async () => {})
    expect(result.current).toBeNull()
  })

  it('changement de compte : la réponse de l’ancien ne vaut pas pour le nouveau', async () => {
    hasCookedAtLeastOnce.mockResolvedValueOnce(true)
    const { result, rerender } = renderHook(({ uid }) => useHasCookedFirstDish(uid), { initialProps: { uid: 'u1' } })
    await waitFor(() => expect(result.current).toBe(true))
    let repondre
    hasCookedAtLeastOnce.mockReturnValueOnce(new Promise((resolve) => { repondre = resolve }))
    rerender({ uid: 'u2' })
    expect(result.current).toBeNull()
    await act(async () => { repondre(false) })
    expect(result.current).toBe(false)
  })

  it('déconnexion : retour à faux', async () => {
    hasCookedAtLeastOnce.mockResolvedValue(true)
    const { result, rerender } = renderHook(({ uid }) => useHasCookedFirstDish(uid), { initialProps: { uid: 'u1' } })
    await waitFor(() => expect(result.current).toBe(true))
    rerender({ uid: 'guest' })
    expect(result.current).toBe(false)
  })
})
