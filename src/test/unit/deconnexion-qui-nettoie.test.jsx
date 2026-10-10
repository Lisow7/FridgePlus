import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Audit du 2026-10-04, lot 16c (CPT-15 (1), SEC-13, et les quatre sorties sans purge trouvées
// en préparant la décision du 2026-10-09) : se déconnecter détache CET appareil des notifications et
// efface ce que le compte a laissé sur l'appareil — quel que soit le bouton qui déconnecte
// (menu du compte, écran banni, « Confirme ton accord », suppression en cours, vérification
// en 2 étapes). Avant : seul le menu du compte effaçait trois clés, le brouillon de recette
// restait, et l'abonnement push de l'appareil continuait d'appartenir au compte précédent.

const m = vi.hoisted(() => ({
  authSignOut: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  profileSingle: vi.fn(),
  profileUpdateEq: vi.fn(),
  profileUpdates: [],
  pushDeleteEq: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    auth: { onAuthStateChange: m.onAuthStateChange, signOut: m.authSignOut, getSession: m.getSession, getUser: vi.fn() },
    from: (table) => {
      if (table === 'profiles') return {
        select: () => ({ eq: () => ({ single: m.profileSingle }) }),
        update: (payload) => { m.profileUpdates.push(payload); return { eq: m.profileUpdateEq } },
      }
      if (table === 'push_subscriptions') return { delete: () => ({ eq: m.pushDeleteEq }) }
      if (table === 'activity_logs') return { insert: vi.fn().mockResolvedValue({ error: null }) }
      return {}
    },
    channel: () => ({ on: () => ({ subscribe: vi.fn() }) }),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}))
vi.mock('@shared/lib/observability/sentry', () => ({ setSentryUser: vi.fn(), clearSentryUser: vi.fn(), logError: m.logError }))
// Le hook de session ne doit pas toucher au réseau.
vi.mock('@features/fridge/api/stock', () => ({ loadStockFromDB: vi.fn(() => Promise.resolve({ stock: new Set(), meta: new Map() })) }))
vi.mock('@features/recipes/api/favorites', () => ({ loadFavoritesFromDB: vi.fn(() => Promise.resolve(new Set())) }))
vi.mock('@features/recipes/lib/custom-recipes', () => ({ loadCustomRecipes: vi.fn(() => Promise.resolve({ recipes: [], error: null })) }))
vi.mock('@shared/lib/migration', () => ({ migrateLocalStorageToDB: vi.fn(() => Promise.resolve()) }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: 'fr', setLang: vi.fn() }) }))

import { AuthProvider, useAuth } from '@shared/contexts/auth-provider'
import { CLES_LOCALES_DU_COMPTE } from '@shared/lib/auth/purge-locale'
import { DRAFT_KEY } from '@features/recipes/lib/recipe-draft'
import { ToastProvider } from '@shared/ui/toast/toast-provider'
import { useUserSession } from '@app/hooks/use-user-session'

const CLES = ['fridge-stock', 'fridge-favorites', 'fridge-custom-recipes', 'fridge-recipe-draft']
const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)
let authCallback = null

// Le navigateur tient un abonnement push (comme après « Activer » dans Cookies et données).
function appareilAbonne(endpoint = 'https://push.exemple/abc') {
  const subscription = { endpoint, unsubscribe: vi.fn().mockResolvedValue(true) }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
  })
  return subscription
}

function garnirLesCles() {
  for (const cle of CLES) localStorage.setItem(cle, '["x"]')
  localStorage.setItem('fridge-lang', 'fr')
}

async function connecte() {
  const rendu = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(authCallback).not.toBeNull())
  await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u1' } }) })
  // Le profil se charge en différé (setTimeout 0) : on laisse passer le minuteur.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  return rendu
}

beforeEach(() => {
  vi.clearAllMocks()
  m.profileUpdates.length = 0
  localStorage.clear()
  sessionStorage.clear()
  authCallback = null
  m.onAuthStateChange.mockImplementation((cb) => { authCallback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  m.getSession.mockResolvedValue({ data: { session: null } })
  m.profileSingle.mockResolvedValue({ data: null, error: null })
  m.profileUpdateEq.mockResolvedValue({ error: null })
  m.pushDeleteEq.mockResolvedValue({ error: null })
  m.authSignOut.mockResolvedValue({})
})
afterEach(() => { delete navigator.serviceWorker })

describe('se déconnecter détache CET appareil des notifications (CPT-15)', () => {
  it('supprime la ligne de cet appareil, puis l’abonnement du navigateur, avant de fermer la session — sans toucher aux préférences du compte', async () => {
    const abonnement = appareilAbonne()
    const ordre = []
    m.pushDeleteEq.mockImplementation(async () => { ordre.push('ligne'); return { error: null } })
    abonnement.unsubscribe.mockImplementation(async () => { ordre.push('navigateur'); return true })
    m.authSignOut.mockImplementation(async () => { ordre.push('session'); return {} })
    const { result } = await connecte()

    await act(async () => { await result.current.signOut() })

    expect(m.pushDeleteEq).toHaveBeenCalledWith('endpoint', 'https://push.exemple/abc')
    expect(ordre).toEqual(['ligne', 'navigateur', 'session'])
    // Les autres appareils du compte gardent leurs rappels : push_preferences n'est pas réécrit.
    expect(m.profileUpdates.some((p) => 'push_preferences' in p)).toBe(false)
  })

  it('un détachement qui échoue ne bloque pas la déconnexion, et s’écrit au journal', async () => {
    const abonnement = appareilAbonne()
    m.pushDeleteEq.mockRejectedValue(new Error('réseau coupé'))
    const { result } = await connecte()

    await act(async () => { await result.current.signOut() })

    expect(m.authSignOut).toHaveBeenCalled()
    expect(abonnement.unsubscribe).not.toHaveBeenCalled()
    expect(m.logError).toHaveBeenCalled()
  })

  it('sans abonnement sur cet appareil, rien à détacher : la session se ferme', async () => {
    const { result } = await connecte()
    await act(async () => { await result.current.signOut() })
    expect(m.pushDeleteEq).not.toHaveBeenCalled()
    expect(m.authSignOut).toHaveBeenCalled()
  })
})

describe('se déconnecter efface ce que le compte a laissé sur l’appareil (SEC-13)', () => {
  it('le signOut du fournisseur efface les quatre clés — donc chaque sortie les efface, pas seulement le menu du compte', async () => {
    garnirLesCles()
    const { result } = await connecte()

    await act(async () => { await result.current.signOut() })

    for (const cle of CLES) expect(localStorage.getItem(cle)).toBeNull()
    // Ce qui appartient à l'appareil reste : la langue.
    expect(localStorage.getItem('fridge-lang')).toBe('fr')
  })

  it('aucun écran ne ferme la session lui-même : tous passent par le signOut du fournisseur', () => {
    const fichiers = []
    const marcher = (dossier) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom)
        if (statSync(chemin).isDirectory()) marcher(chemin)
        else if (/\.(js|jsx)$/.test(nom)) fichiers.push(chemin)
      }
    }
    marcher('src/features'); marcher('src/app'); marcher('src/routes')
    const fautifs = fichiers.filter((f) => /supabase\.auth\.signOut\(/.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })
})

// Décision du 2026-10-08 : « Se déconnecter » = cet
// appareil ; « Déconnecter tous mes appareils » dans Compte & sécurité ; supprimer
// son compte et changer de mot de passe déconnectent toujours partout (CPT-18).
// Jusque-là, « Se déconnecter » du téléphone déconnectait aussi l'ordinateur.
describe('la portée de la déconnexion', () => {
  it('« Se déconnecter » ferme la session de CET appareil seulement', async () => {
    const { result } = await connecte()
    await act(async () => { await result.current.signOut() })
    expect(m.authSignOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('« Déconnecter tous mes appareils » : toutes les sessions, et les notifications de tous les appareils du compte, avant', async () => {
    const ordre = []
    m.pushDeleteEq.mockImplementation(async (colonne) => { ordre.push(`notifications:${colonne}`); return { error: null } })
    m.authSignOut.mockImplementation(async () => { ordre.push('session'); return { error: null } })
    const { result } = await connecte()
    let res
    await act(async () => { res = await result.current.deconnecterTousLesAppareils() })
    expect(res).toEqual({ error: null })
    expect(m.authSignOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(m.pushDeleteEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(ordre).toEqual(['notifications:user_id', 'session'])
    expect(result.current.user).toBeNull()
  })

  it('une déconnexion de tous les appareils qui échoue se rend, et le compte reste ouvert ici', async () => {
    m.authSignOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    const { result } = await connecte()
    let res
    await act(async () => { res = await result.current.deconnecterTousLesAppareils() })
    expect(res.error).toEqual({ message: 'Failed to fetch' })
    expect(result.current.user).toEqual({ id: 'u1' })
  })
})

// Décision du 2026-10-08 : une session qui se ferme sans geste d'ici
// (expirée, fermée depuis un autre appareil) le dit dans le bandeau du haut ; une
// déconnexion voulue n'affiche rien. Jusque-là, l'app repassait en invité sans un mot.
describe('la session perdue se dit', () => {
  const signOutQuiPrevient = () => m.authSignOut.mockImplementation(async () => {
    await authCallback('SIGNED_OUT', null)
    return { error: null }
  })

  it('fermée sans geste d’ici : sessionPerdue', async () => {
    const { result } = await connecte()
    await act(async () => { await authCallback('SIGNED_OUT', null) })
    expect(result.current.user).toBeNull()
    expect(result.current.sessionPerdue).toBe(true)
  })

  it('« Se déconnecter » n’affiche rien', async () => {
    signOutQuiPrevient()
    const { result } = await connecte()
    await act(async () => { await result.current.signOut() })
    expect(result.current.sessionPerdue).toBe(false)
  })

  it('« Déconnecter tous mes appareils » non plus', async () => {
    signOutQuiPrevient()
    const { result } = await connecte()
    await act(async () => { await result.current.deconnecterTousLesAppareils() })
    expect(result.current.sessionPerdue).toBe(false)
  })

  it('après une déconnexion voulue, une session perdue se dit de nouveau', async () => {
    signOutQuiPrevient()
    const { result } = await connecte()
    await act(async () => { await result.current.signOut() })
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u1' } }) })
    await act(async () => { await authCallback('SIGNED_OUT', null) })
    expect(result.current.sessionPerdue).toBe(true)
  })

  it('se reconnecter, ou fermer le bandeau, l’efface', async () => {
    const { result } = await connecte()
    await act(async () => { await authCallback('SIGNED_OUT', null) })
    await act(async () => { await authCallback('SIGNED_IN', { user: { id: 'u1' } }) })
    expect(result.current.sessionPerdue).toBe(false)
    await act(async () => { await authCallback('SIGNED_OUT', null) })
    act(() => { result.current.oublierLaSessionPerdue() })
    expect(result.current.sessionPerdue).toBe(false)
  })

  // Au démarrage, la bibliothèque peut refuser la session gardée (fermée depuis
  // un autre appareil) AVANT que l'app l'écoute : le témoin, lui, est resté.
  it('au démarrage, une session gardée mais refusée : sessionPerdue', async () => {
    localStorage.setItem('fridge-session-ouverte', '1')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await act(async () => { await authCallback('INITIAL_SESSION', null) })
    expect(result.current.sessionPerdue).toBe(true)
    expect(localStorage.getItem('fridge-session-ouverte')).toBeNull()
  })

  it('une sortie voulue faite dans un autre onglet n’affiche rien ici', async () => {
    const { result } = await connecte()
    expect(localStorage.getItem('fridge-session-ouverte')).toBe('1')
    localStorage.removeItem('fridge-session-ouverte') // l'autre onglet s'est déconnecté
    await act(async () => { await authCallback('SIGNED_OUT', null) })
    expect(result.current.sessionPerdue).toBe(false)
  })

  it('« Déconnecter tous mes appareils » refusée : la session reste, son témoin aussi', async () => {
    m.authSignOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })
    const { result } = await connecte()
    await act(async () => { await result.current.deconnecterTousLesAppareils() })
    expect(localStorage.getItem('fridge-session-ouverte')).toBe('1')
  })

  it('un visiteur sans session : rien', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(authCallback).not.toBeNull())
    await act(async () => { await authCallback('INITIAL_SESSION', null) })
    expect(result.current.sessionPerdue).toBe(false)
  })
})

describe('la liste des clés purgées suit les modules qui les écrivent', () => {
  it('contient la clé du brouillon et celles du frigo, des favoris et des recettes perso', () => {
    expect(CLES_LOCALES_DU_COMPTE).toContain(DRAFT_KEY)
    for (const [fichier, motif] of [
      ['src/features/fridge/hooks/use-fridge-stock.js', /LOCALSTORAGE_KEY = '([^']+)'/],
      ['src/features/recipes/hooks/use-favorites.js', /LOCALSTORAGE_KEY = '([^']+)'/],
      ['src/features/recipes/api/recipes.js', /LS_KEY = '([^']+)'/],
    ]) {
      const cle = readFileSync(fichier, 'utf8').match(motif)?.[1]
      expect(cle, fichier).toBeTruthy()
      expect(CLES_LOCALES_DU_COMPTE).toContain(cle)
    }
  })
})

describe('useUserSession', () => {
  function props(user) {
    return {
      user, signOut: vi.fn(), setStock: vi.fn(), setStockMeta: vi.fn(), setFavorites: vi.fn(), setCustomRecipes: vi.fn(),
      setShowRecipes: vi.fn(), setDeletingRecipe: vi.fn(), setActiveSubcat: vi.fn(),
      modals: { admin: { close: vi.fn() }, support: { close: vi.fn() }, cart: { close: vi.fn() } },
    }
  }

  it('la session qui expire (ou fermée ailleurs) efface aussi les clés locales du compte', () => {
    garnirLesCles()
    const p = props({ id: 'u1' })
    const { rerender } = renderHook(({ x }) => useUserSession(x), { initialProps: { x: p }, wrapper: ToastProvider })
    rerender({ x: { ...p, user: null } })
    for (const cle of CLES) expect(localStorage.getItem(cle)).toBeNull()
    expect(localStorage.getItem('fridge-lang')).toBe('fr')
  })

  it('un pur invité garde ses clés : rien n’est effacé sans compte avant', () => {
    garnirLesCles()
    renderHook(() => useUserSession(props(null)), { wrapper: ToastProvider })
    for (const cle of CLES) expect(localStorage.getItem(cle)).toBe('["x"]')
  })

  it('handleSignOut efface aussi le brouillon de recette, puis déconnecte', async () => {
    garnirLesCles()
    const p = props({ id: 'u1' })
    const { result } = renderHook(() => useUserSession(p), { wrapper: ToastProvider })
    await act(async () => { await result.current.handleSignOut() })
    expect(localStorage.getItem('fridge-recipe-draft')).toBeNull()
    expect(p.signOut).toHaveBeenCalled()
  })
})
