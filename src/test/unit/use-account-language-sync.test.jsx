import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'

const etat = vi.hoisted(() => ({ user: null, profile: null, lang: 'fr' }))
const updateProfile = vi.hoisted(() => vi.fn())
const setLang = vi.hoisted(() => vi.fn())
const retenir = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: etat.user, profile: etat.profile, updateProfile }),
}))
vi.mock('@shared/contexts/ui-provider', () => ({
  useLang: () => ({ lang: etat.lang, setLang }),
}))
vi.mock('@shared/api/langue-du-compte', () => ({ retenirLaLangueDesEmails: retenir }))

import { useAccountLanguageSync } from '@shared/hooks/use-account-language-sync'

// Audit du 2026-10-04, P-08. La langue ne vivait que dans le navigateur :
//   - un compte qui change d'appareil retrouvait la langue du navigateur ;
//   - `profiles.language` n'était écrite par PERSONNE (vide pour tous les comptes
//     le 2026-10-04), alors que quatre fonctions du serveur la lisent pour
//     choisir la langue des e-mails et des notifications : tout partait en
//     français, quelle que soit la langue de la personne.
const BOB = { id: 'u-bob' }
const compte = (language, id = 'u-bob') => ({ id, language })

describe('useAccountLanguageSync', () => {
  beforeEach(() => {
    etat.user = null
    etat.profile = null
    etat.lang = 'fr'
    updateProfile.mockReset()
    // L'écriture réussie se retrouve dans le profil, comme dans l'app.
    updateProfile.mockImplementation(async (champs) => { etat.profile = { ...etat.profile, ...champs }; return { error: null } })
    setLang.mockReset()
    setLang.mockImplementation((code) => { etat.lang = code })
    retenir.mockReset()
    retenir.mockResolvedValue({ error: null })
  })

  it('invité : rien n’est lu ni écrit', () => {
    renderHook(() => useAccountLanguageSync())
    expect(updateProfile).not.toHaveBeenCalled()
    expect(setLang).not.toHaveBeenCalled()
  })

  it('profil pas encore chargé : on attend', () => {
    etat.user = BOB
    renderHook(() => useAccountLanguageSync())
    expect(updateProfile).not.toHaveBeenCalled()
    expect(setLang).not.toHaveBeenCalled()
  })

  it('le compte a une langue : l’appareil la prend, et rien n’est réécrit', () => {
    etat.user = BOB
    etat.profile = compte('en')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    expect(setLang).toHaveBeenCalledWith('en')
    rerender()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('le compte n’a pas encore de langue : il prend celle de l’appareil, une fois', async () => {
    etat.user = BOB
    etat.profile = compte(null)
    etat.lang = 'en'
    const { rerender } = renderHook(() => useAccountLanguageSync())
    await act(async () => {})
    rerender()
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(updateProfile).toHaveBeenCalledWith({ language: 'en' })
    expect(setLang).not.toHaveBeenCalled()
  })

  it('compte et appareil d’accord : rien ne bouge', () => {
    etat.user = BOB
    etat.profile = compte('fr')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    rerender()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(setLang).not.toHaveBeenCalled()
  })

  it('la langue change ICI : le compte la retient', async () => {
    etat.user = BOB
    etat.profile = compte('fr')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    etat.lang = 'en' // la personne bascule en anglais
    rerender()
    await act(async () => {})
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(updateProfile).toHaveBeenCalledWith({ language: 'en' })
    expect(setLang).not.toHaveBeenCalled()
  })

  it('la langue change AILLEURS (autre appareil) : celui-ci suit, sans la réécrire', () => {
    etat.user = BOB
    etat.profile = compte('fr')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    etat.profile = compte('en') // arrive par le canal temps réel du profil
    rerender()
    expect(setLang).toHaveBeenCalledWith('en')
    rerender()
    // Pas de ping-pong : l'appareil n'impose pas son ancienne langue au compte.
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('changement de compte : la langue du nouveau compte s’applique', () => {
    etat.user = BOB
    etat.profile = compte('fr')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    etat.user = { id: 'u-alice' }
    etat.profile = compte('en', 'u-alice')
    rerender()
    expect(setLang).toHaveBeenCalledWith('en')
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('une écriture qui échoue ne ramène pas l’écran à l’ancienne langue', async () => {
    updateProfile.mockImplementation(async () => ({ error: { message: 'Failed to fetch' } }))
    etat.user = BOB
    etat.profile = compte('fr')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    etat.lang = 'en'
    rerender()
    await act(async () => {})
    rerender()
    expect(setLang).not.toHaveBeenCalled()
    expect(etat.lang).toBe('en')
  })

  it('une langue inconnue dans le compte (ancien réglage) ne casse rien', () => {
    setLang.mockImplementation(() => { /* l'interface refuse un code qu'elle ne propose pas */ })
    etat.user = BOB
    etat.profile = compte('ja')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    rerender()
    expect(etat.lang).toBe('fr')
  })

  it('en mode strict (effets joués deux fois), une seule écriture part', async () => {
    etat.user = BOB
    etat.profile = compte(null)
    renderHook(() => useAccountLanguageSync(), { wrapper: StrictMode })
    await act(async () => {})
    expect(updateProfile).toHaveBeenCalledTimes(1)
  })
})

// Audit du 2026-10-04, CPT-18 : les e-mails de Supabase Auth (confirmation,
// mot de passe oublié, changement d'adresse) lisent la langue dans
// user_metadata (`{{ .Data.lang }}`), que seule l'inscription par e-mail
// écrivait : un compte Google n'en avait pas, et un changement de langue n'y
// arrivait jamais.
describe('la langue des e-mails de connexion suit le compte', () => {
  const avecLangue = (lang) => ({ id: 'u-bob', user_metadata: lang ? { lang } : { full_name: 'Bob' } })

  beforeEach(() => {
    etat.user = null
    etat.profile = null
    etat.lang = 'fr'
    updateProfile.mockReset()
    updateProfile.mockImplementation(async (champs) => { etat.profile = { ...etat.profile, ...champs }; return { error: null } })
    setLang.mockReset()
    setLang.mockImplementation((code) => { etat.lang = code })
    retenir.mockReset()
    retenir.mockResolvedValue({ error: null })
  })

  it('recopiée dans user_metadata quand elle en diffère', () => {
    etat.user = avecLangue('fr')
    etat.profile = compte('en')
    renderHook(() => useAccountLanguageSync())
    expect(retenir).toHaveBeenCalledTimes(1)
    expect(retenir).toHaveBeenCalledWith('en')
  })

  it('déjà la même : rien ne part', () => {
    etat.user = avecLangue('en')
    etat.profile = compte('en')
    etat.lang = 'en'
    const { rerender } = renderHook(() => useAccountLanguageSync())
    rerender()
    expect(retenir).not.toHaveBeenCalled()
  })

  it('un compte sans langue (Google) la reçoit dès que le profil l’a', async () => {
    etat.user = avecLangue(null)
    etat.profile = compte(null)
    etat.lang = 'en'
    const { rerender } = renderHook(() => useAccountLanguageSync())
    await act(async () => {})
    rerender()
    expect(retenir).toHaveBeenCalledTimes(1)
    expect(retenir).toHaveBeenCalledWith('en')
  })

  it('une langue que l’application ne propose pas ne se recopie pas', () => {
    setLang.mockImplementation(() => { /* l'interface refuse un code qu'elle ne propose pas */ })
    etat.user = avecLangue('fr')
    etat.profile = compte('ja')
    renderHook(() => useAccountLanguageSync())
    expect(retenir).not.toHaveBeenCalled()
  })

  it('en mode strict (effets joués deux fois), une seule recopie part', () => {
    etat.user = avecLangue('fr')
    etat.profile = compte('en')
    renderHook(() => useAccountLanguageSync(), { wrapper: StrictMode })
    expect(retenir).toHaveBeenCalledTimes(1)
  })

  it('une recopie qui échoue se retente à la prochaine occasion', async () => {
    retenir.mockResolvedValueOnce({ error: { message: 'Failed to fetch' } })
    etat.user = avecLangue('fr')
    etat.profile = compte('en')
    const { rerender } = renderHook(() => useAccountLanguageSync())
    await act(async () => {})
    etat.profile = compte('fr') // la langue du compte revient à celle des e-mails…
    rerender()
    etat.profile = compte('en') // … puis repart : l'échec n'a pas bloqué la clé
    rerender()
    await act(async () => {})
    expect(retenir).toHaveBeenCalledTimes(2)
    expect(retenir).toHaveBeenLastCalledWith('en')
  })

  it('invité : rien', () => {
    renderHook(() => useAccountLanguageSync())
    expect(retenir).not.toHaveBeenCalled()
  })
})
