import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// La « base » : chaque requête rend ce qu'on lui a prévu, dans l'ordre d'appel.
const etat = vi.hoisted(() => ({ resultats: [], rpc: null }))

vi.mock('@shared/lib/supabase/client', () => {
  const requete = () => {
    const resultat = () => etat.resultats.shift() ?? { data: [], count: 0, error: null }
    const q = {}
    for (const f of ['select', 'eq', 'in', 'is', 'not', 'neq', 'ilike', 'order', 'limit', 'range', 'gte', 'or']) q[f] = () => q
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return {
    supabase: {
      from: () => requete(),
      rpc: () => Promise.resolve(etat.rpc ?? { data: [], error: null }),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'a' } } }) },
    },
  }
})

import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { adminGetAnalyticsData, adminGetStats } from '@features/admin/api/admin'
import { adminCountCommunityRecipesByStatus, countAllRecipes } from '@shared/lib/recipes/recipes-repository'
import { adminCountOpenTickets } from '@features/support/api/support'
import { loadFeatureFlags, fetchFeatureFlags } from '@shared/api/feature-flags'

const PANNE = { data: null, count: null, error: { message: 'permission denied', code: '42501' } }

beforeEach(() => { etat.resultats = []; etat.rpc = null })

// Audit du 2026-10-04, ADM-09 : deux recherches envoyaient une requête par
// frappe (deux pour Avis), et la réponse d'une frappe ancienne pouvait arriver
// après la récente.
describe('useDebouncedValue — une valeur qui a cessé de changer', () => {
  afterEach(() => vi.useRealTimers())

  it('ne suit la valeur qu’après 300 ms de calme', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), { initialProps: { v: '' } })
    rerender({ v: 't' }); rerender({ v: 'to' }); rerender({ v: 'tom' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('tom')
  })
})

// Audit du 2026-10-04, ADM-08 : ces lectures changeaient une erreur en 0, {} ou
// [] — un compteur à 0 cache le badge, et se lit « rien à modérer ».
describe.each([
  ['adminCountCommunityRecipesByStatus', () => adminCountCommunityRecipesByStatus('pending')],
  ['countAllRecipes', () => countAllRecipes()],
  ['adminCountOpenTickets', () => adminCountOpenTickets()],
])('%s — un comptage raté n’est pas un zéro', (_, appel) => {
  it('la base refuse : l’appel lève, avec le code', async () => {
    etat.resultats = [PANNE]
    await expect(appel()).rejects.toMatchObject({ code: '42501' })
  })

  it('la base répond : le nombre (témoin)', async () => {
    etat.resultats = [{ data: null, count: 7, error: null }]
    await expect(appel()).resolves.toBe(7)
  })
})

// Depuis le lot 12l, les compteurs et l'activité du tableau de bord sont UNE
// fonction de la base chacun (`admin_compteurs`, `admin_activite_par_jour`) :
// un refus doit toujours faire lever (détail dans `admin-compteurs-api.test.js`).
describe('adminGetStats', () => {
  it('la base refuse les compteurs : lève, avec le code', async () => {
    etat.rpc = PANNE
    await expect(adminGetStats()).rejects.toMatchObject({ code: '42501' })
  })
})

describe('adminGetAnalyticsData — le graphique du tableau de bord', () => {
  it('la base refuse l’activité : lève — le graphique dit « échec », pas « aucune donnée »', async () => {
    etat.rpc = PANNE
    await expect(adminGetAnalyticsData()).rejects.toMatchObject({ code: '42501' })
  })
})

// `adminGetAuthUsers` (les e-mails de TOUS les comptes, sans trace) n'existe
// plus depuis le 2026-10-08 (audit ADM-05) : un compte à la fois, avec un
// motif, par `adminRevelerCompte` — voir `consultations-tracees-api.test.js`.

describe('drapeaux de fonctionnalités', () => {
  it('loadFeatureFlags (panneau admin) rend l’erreur', async () => {
    etat.resultats = [PANNE]
    const { data, error } = await loadFeatureFlags()
    expect(data).toEqual([])
    expect(error).toMatchObject({ code: '42501' })
  })

  it('fetchFeatureFlags (démarrage de l’app) reste silencieux : une panne ne doit pas casser l’accueil', async () => {
    etat.resultats = [PANNE]
    expect(await fetchFeatureFlags()).toEqual([])
  })
})
