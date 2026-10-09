import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { supprimerAvecAnnulation, messageErreurAdmin } from '@features/admin/lib/ecritures-admin'
import { useFeedback } from '@features/admin/hooks/use-feedback'

// Audit du 2026-10-04, ADM-02 : les suppressions « avec annulation » du panneau
// s'écrivaient `onConfirm: async () => { await adminX(id); retirer() }` — le
// résultat jeté, la ligne retirée même quand la base refusait.
describe('supprimerAvecAnnulation — une suppression dont on vérifie l’issue', () => {
  function monter(supprimer) {
    let options = null
    const trigger = (o) => { options = o }
    let masques = new Set()
    const setMasques = (maj) => { masques = maj(masques) }
    const retirer = vi.fn()
    const siEchec = vi.fn()
    supprimerAvecAnnulation(trigger, { label: 'Ticket supprimé', id: 't-1', setMasques, supprimer, retirer, siEchec })
    return { options: () => options, masques: () => masques, retirer, siEchec }
  }

  it('la ligne est masquée tout de suite, et le bandeau d’annulation part avec son libellé', () => {
    const s = monter(async () => ({ error: null }))
    expect(s.masques().has('t-1')).toBe(true)
    expect(s.options().label).toBe('Ticket supprimé')
  })

  it('« Annuler » : la ligne revient, rien n’est supprimé', () => {
    const supprimer = vi.fn()
    const s = monter(supprimer)
    s.options().onUndo()
    expect(s.masques().has('t-1')).toBe(false)
    expect(supprimer).not.toHaveBeenCalled()
  })

  it('la base accepte : la ligne quitte la liste', async () => {
    const s = monter(async () => ({ error: null }))
    await s.options().onConfirm()
    expect(s.retirer).toHaveBeenCalled()
    expect(s.siEchec).not.toHaveBeenCalled()
  })

  it('la base refuse : la ligne revient, et l’échec est dit', async () => {
    const refus = { code: 'no_rows_affected', message: 'no_rows_affected' }
    const s = monter(async () => ({ error: refus }))
    await s.options().onConfirm()
    expect(s.retirer).not.toHaveBeenCalled()
    expect(s.masques().has('t-1')).toBe(false)
    expect(s.siEchec).toHaveBeenCalledWith(refus)
  })

  it('l’appel lève : même chose', async () => {
    const s = monter(async () => { throw new TypeError('Failed to fetch') })
    await s.options().onConfirm()
    expect(s.retirer).not.toHaveBeenCalled()
    expect(s.masques().has('t-1')).toBe(false)
    expect(s.siEchec).toHaveBeenCalledWith(expect.any(TypeError))
  })
})

describe('messageErreurAdmin — ce qu’on dit quand une écriture échoue', () => {
  it('rien n’a été touché', () => {
    expect(messageErreurAdmin({ code: 'no_rows_affected' }, 'fr'))
      .toBe('Rien n\'a été modifié : l\'élément n\'existe plus, ou les droits ne le permettent pas.')
  })
  it('« Accès refusé » seulement pour un vrai refus de droits (42501)', () => {
    expect(messageErreurAdmin({ code: '42501', message: 'permission denied' }, 'fr')).toBe('Accès refusé par la base.')
    expect(messageErreurAdmin({ message: 'Failed to fetch' }, 'fr')).toBe('Échec : Failed to fetch')
  })
  it('une erreur sous forme de texte, et en anglais', () => {
    expect(messageErreurAdmin('timeout', 'en')).toBe('Failed: timeout')
    expect(messageErreurAdmin(null, 'en')).toBe('Failed: unknown error')
  })
})

describe('useFeedback — le bandeau de retour d’une section', () => {
  afterEach(() => vi.useRealTimers())

  it('affiche puis efface le message', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFeedback())
    act(() => result.current[1](false, 'Échec : boom'))
    expect(result.current[0]).toEqual({ ok: false, msg: 'Échec : boom' })
    act(() => vi.advanceTimersByTime(3500))
    expect(result.current[0]).toBeNull()
  })

  it('un second message n’est pas effacé par le minuteur du premier', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useFeedback())
    act(() => result.current[1](true, 'premier'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current[1](false, 'second'))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current[0]).toEqual({ ok: false, msg: 'second' })
  })
})
