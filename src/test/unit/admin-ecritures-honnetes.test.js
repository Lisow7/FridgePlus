import { describe, it, expect, vi, beforeEach } from 'vitest'

// La « base » : chaque requête rend ce qu'on lui a prévu ; on garde la trace
// de chaque requête (table, verbe, filtres, `.select` demandé ou non).
const etat = vi.hoisted(() => ({ resultats: [], requetes: [], utilisateur: { id: 'admin-1' } }))

vi.mock('@shared/lib/supabase/client', () => {
  const requete = (table) => {
    const trace = { table, verbe: null, filtres: [], selection: null }
    etat.requetes.push(trace)
    const resultat = () => etat.resultats.shift() ?? { data: [{ id: 'x' }], error: null }
    const q = {}
    for (const verbe of ['insert', 'update', 'delete', 'upsert']) q[verbe] = (...a) => { trace.verbe = verbe; trace.args = a; return q }
    for (const f of ['eq', 'in', 'is', 'neq', 'order', 'limit', 'range']) q[f] = (...a) => { trace.filtres.push([f, ...a]); return q }
    q.select = (cols) => { trace.selection = cols; return q }
    q.single = () => Promise.resolve(resultat())
    q.maybeSingle = () => Promise.resolve(resultat())
    q.then = (ok, ko) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }
  return {
    supabase: {
      from: (table) => requete(table),
      auth: { getUser: () => Promise.resolve({ data: { user: etat.utilisateur } }) },
      functions: { invoke: () => Promise.resolve({ error: null }) },
    },
  }
})

import {
  markTicketReadByAdmin, adminSetTicketStatus, adminDeleteMessage, adminDeleteAnyMessage,
  adminDeleteTicket, adminReplyTicket,
} from '@features/support/api/support'
import { adminDeleteIngredient } from '@features/admin/api/admin'
import {
  adminUpdateCommunityRecipe, adminSoftDeleteCommunityRecipe, adminDeleteOfficialRecipe,
} from '@shared/lib/recipes/recipes-repository'
import { setFeatureFlag } from '@shared/api/feature-flags'

beforeEach(() => { etat.resultats = []; etat.requetes = [] })

const AUCUNE_LIGNE = { data: [], error: null }
const REFUS = { data: null, error: { message: 'boom', code: 'XX000' } }
const ecritures = () => etat.requetes.filter((r) => r.verbe)

// Audit du 2026-10-04, ADM-26 : quand la règle de la base filtre la ligne,
// PostgREST répond sans erreur et 0 ligne — l'écran annonçait un succès. Chaque
// écriture du panneau demande désormais les lignes touchées : 0 ligne = échec.
describe.each([
  ['markTicketReadByAdmin', () => markTicketReadByAdmin('t-1'), 'support_tickets', 'update'],
  ['adminSetTicketStatus', () => adminSetTicketStatus('t-1', 'resolved'), 'support_tickets', 'update'],
  ['adminDeleteMessage', () => adminDeleteMessage('m-1'), 'support_messages', 'delete'],
  ['adminDeleteAnyMessage', () => adminDeleteAnyMessage('m-1'), 'support_messages', 'delete'],
  ['adminDeleteTicket', () => adminDeleteTicket('t-1'), 'support_tickets', 'delete'],
  ['adminDeleteIngredient', () => adminDeleteIngredient('ing-1'), 'ingredients', 'delete'],
  ['adminUpdateCommunityRecipe (dépôt)', () => adminUpdateCommunityRecipe('r-1', { title: 'x' }), 'custom_recipes', 'update'],
  ['adminSoftDeleteCommunityRecipe', () => adminSoftDeleteCommunityRecipe('r-1'), 'custom_recipes', 'update'],
  ['adminDeleteOfficialRecipe', () => adminDeleteOfficialRecipe('r-1'), 'base_recipes', 'delete'],
  // `feature_flags` n'a pas de colonne `id` : sa clé est `key`.
  ['setFeatureFlag', () => setFeatureFlag('scan', true), 'feature_flags', 'update', 'key'],
])('%s — une écriture qui ne touche rien est un échec', (_, appel, table, verbe, cle = 'id') => {
  it('demande les lignes touchées', async () => {
    await appel()
    const ecriture = ecritures().find((r) => r.table === table && r.verbe === verbe)
    expect(ecriture).toBeTruthy()
    expect(ecriture.selection).toBe(cle)
  })

  it('une ligne touchée : succès', async () => {
    const { error } = await appel()
    expect(error ?? null).toBeNull()
  })

  it('aucune ligne touchée : une erreur, pas un succès', async () => {
    etat.resultats = [AUCUNE_LIGNE]
    const { error } = await appel()
    expect(error?.code).toBe('no_rows_affected')
  })

  it('la base refuse : l’erreur est rendue', async () => {
    etat.resultats = [REFUS]
    const { error } = await appel()
    expect(error?.message).toBe('boom')
  })
})

describe('les écritures du support', () => {
  it('supprimer un ticket ne fait qu’une requête : ses messages suivent par la clé étrangère', async () => {
    await adminDeleteTicket('t-1')
    expect(ecritures().map((r) => `${r.verbe} ${r.table}`)).toEqual(['delete support_tickets'])
  })

  it('répondre n’écrit que le message : la base met le ticket à jour dans la même transaction', async () => {
    const { error } = await adminReplyTicket('t-1', null, 'Bonjour', 'fr')
    expect(error).toBeNull()
    expect(ecritures().map((r) => `${r.verbe} ${r.table}`)).toEqual(['insert support_messages'])
  })

  it('répondre : un refus de la base est rendu', async () => {
    etat.resultats = [REFUS]
    const { error } = await adminReplyTicket('t-1', null, 'Bonjour', 'fr')
    expect(error?.message).toBe('boom')
  })
})

// Bannir ne passe plus par une écriture du client (`adminToggleBan`, retiré
// le 2026-10-06) : `admin_bannir` pose le bannissement ET écrit au journal dans
// la même transaction, et lève `user_not_found` avant toute trace quand le
// compte n'existe pas. Ses refus sont testés dans `bannir-par-la-base.test.js`.
