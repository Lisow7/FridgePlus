import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const etat = vi.hoisted(() => ({ authLinkProblem: null }))
const clearAuthLinkProblem = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ authLinkProblem: etat.authLinkProblem, clearAuthLinkProblem }),
}))

import { useEmailLinkBanner, EMAIL_LINK_MESSAGES } from '@shared/hooks/use-email-link-banner'
import { SUPPORT_EMAIL } from '@shared/lib/contact'

// Le bandeau du haut de l'app dit ce qu'est devenu un lien reçu par e-mail :
// restauration de compte (existant), et depuis le 2026-10-04 les liens de
// connexion qui n'aboutissent pas (audit CPT-03).
describe('useEmailLinkBanner', () => {
  const restoreAccount = vi.fn()

  beforeEach(() => {
    etat.authLinkProblem = null
    clearAuthLinkProblem.mockReset()
    restoreAccount.mockReset()
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => { vi.useRealTimers(); window.history.replaceState(null, '', '/') })

  it('rien à dire : pas de bandeau', () => {
    const { result } = renderHook(() => useEmailLinkBanner({ lang: 'fr', restoreAccount }))
    expect(result.current[0]).toBeNull()
  })

  it.each(['expired', 'no-session', 'failed'])('lien « %s » : un bandeau d’erreur, dans la langue', (probleme) => {
    etat.authLinkProblem = probleme
    const fr = renderHook(() => useEmailLinkBanner({ lang: 'fr', restoreAccount })).result.current[0]
    const en = renderHook(() => useEmailLinkBanner({ lang: 'en', restoreAccount })).result.current[0]
    expect(fr).toEqual({ ok: false, msg: EMAIL_LINK_MESSAGES.fr[probleme] })
    expect(en).toEqual({ ok: false, msg: EMAIL_LINK_MESSAGES.en[probleme] })
    expect(fr.msg).not.toBe(en.msg)
  })

  it('chaque message dit quoi faire ensuite', () => {
    // Lien expiré : en redemander un. Pas de session ici : se connecter, ou
    // refaire la demande depuis cet appareil. Échec : réessayer, puis écrire.
    expect(EMAIL_LINK_MESSAGES.fr.expired).toMatch(/demande-en un nouveau/i)
    expect(EMAIL_LINK_MESSAGES.fr['no-session']).toMatch(/connecte-toi/i)
    expect(EMAIL_LINK_MESSAGES.fr['no-session']).toMatch(/depuis cet appareil/i)
    expect(EMAIL_LINK_MESSAGES.fr.failed).toContain(SUPPORT_EMAIL)
    expect(EMAIL_LINK_MESSAGES.en.failed).toContain(SUPPORT_EMAIL)
  })

  it('fermer le bandeau efface le problème', () => {
    etat.authLinkProblem = 'expired'
    const { result } = renderHook(() => useEmailLinkBanner({ lang: 'fr', restoreAccount }))
    act(() => result.current[1]())
    expect(clearAuthLinkProblem).toHaveBeenCalledTimes(1)
  })

  it('ce bandeau-là ne se ferme pas tout seul : il faut le temps de le lire', () => {
    vi.useFakeTimers()
    etat.authLinkProblem = 'no-session'
    const { result } = renderHook(() => useEmailLinkBanner({ lang: 'fr', restoreAccount }))
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(result.current[0]).not.toBeNull()
    expect(clearAuthLinkProblem).not.toHaveBeenCalled()
  })

  it('la restauration de compte garde son bandeau, et passe devant', async () => {
    restoreAccount.mockResolvedValue({ error: null })
    etat.authLinkProblem = 'expired'
    window.history.replaceState(null, '', '/?restore-account=jeton')
    const { result } = renderHook(() => useEmailLinkBanner({ lang: 'fr', restoreAccount }))
    await waitFor(() => expect(result.current[0]?.ok).toBe(true))
    expect(restoreAccount).toHaveBeenCalledWith('jeton')
    expect(result.current[0].msg).toMatch(/compte restauré/i)
  })
})
