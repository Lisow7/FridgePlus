import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Une suppression qui ÉCHOUE ne doit pas faire disparaître l'élément.
//
// ── Comment ce défaut a été trouvé ───────────────────────────────────────
// Généralisation du lot 19 : un balayage a recensé les 101 fonctions dont le
// contrat est « je rends mon erreur » (`return { error }` / `return { ok }`),
// puis leurs appels dont le résultat est **jeté**. 35 sites. La plupart sont
// légitimes — la journalisation d'audit est délibérément « au mieux », bloquer
// une modération sur un échec de journal serait pire.
//
// 🔴 Mais six d'entre eux jetaient l'erreur ET modifiaient l'état local
// **quand même**. Le résultat n'est alors pas un simple silence : l'interface
// AFFIRME que l'action a eu lieu. Un message supprimé de l'écran mais toujours
// en base, un ticket affiché « résolu » mais resté ouvert, un post retiré de la
// liste mais toujours publié — jusqu'au rechargement suivant.
//
// Ce fichier couvre les trois sites du panneau de support, les seuls testables
// sans monter un écran entier. Les trois autres portent leur raison en
// commentaire dans le code.

const mockDeleteMessage = vi.hoisted(() => vi.fn())
const mockDeleteTicket  = vi.hoisted(() => vi.fn())
const mockUpdateTitle   = vi.hoisted(() => vi.fn())

vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn().mockResolvedValue([]),
  getTicketMessages: vi.fn().mockResolvedValue([]),
  createTicket: vi.fn(),
  sendUserMessage: vi.fn(),
  markTicketReadByUser: vi.fn().mockResolvedValue({ error: null }),
  deleteUserMessage: (...a) => mockDeleteMessage(...a),
  deleteUserTicket: (...a) => mockDeleteTicket(...a),
  updateTicketTitle: (...a) => mockUpdateTitle(...a),
  searchBaseRecipes: vi.fn(), searchCommunityRecipes: vi.fn(),
  searchIngredients: vi.fn(), searchUsersForReport: vi.fn(),
}))
// La confirmation est toujours accordée : ce n'est pas l'objet du test.
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))
vi.mock('@shared/api/reports', () => ({ createReport: vi.fn() }))
vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: vi.fn() }))

import useSupportPanel from '@features/support/hooks/use-support-panel'

const ECHEC = { error: { message: 'RLS refuse' } }
const SUCCES = { error: null }

// Le hook charge les tickets au montage : sans purger cet effet d'abord, la
// liste amorcee ci-dessous serait ecrasee par la reponse (vide) du chargement.
async function monter(amorce) {
  const { result } = renderHook(() => useSupportPanel({ userId: 'u-1', lang: 'fr' }))
  await act(async () => {})
  act(() => { amorce(result.current) })
  return result
}

beforeEach(() => {
  for (const m of [mockDeleteMessage, mockDeleteTicket, mockUpdateTitle]) m.mockReset()
})

describe('Panneau support — un échec ne doit pas être maquillé en succès', () => {
  it('🔴 supprimer un message qui échoue : le message RESTE, une erreur s\'affiche', async () => {
    mockDeleteMessage.mockResolvedValue(ECHEC)
    const r = await monter(api => api.setMessages([{ id: 'm-1' }, { id: 'm-2' }]))

    await act(async () => { await r.current.handleDeleteMessage('m-1') })

    // Le cœur du test : la liste est intacte. L'ancien code la filtrait quand
    // même, faisant disparaître de l'écran un message toujours en base.
    expect(r.current.messages.map(m => m.id)).toEqual(['m-1', 'm-2'])
    expect(r.current.error).toBe('L\'opération a échoué. Rien n\'a été modifié.')
  })

  it('supprimer un message qui réussit : le message part', async () => {
    mockDeleteMessage.mockResolvedValue(SUCCES)
    const r = await monter(api => api.setMessages([{ id: 'm-1' }, { id: 'm-2' }]))

    await act(async () => { await r.current.handleDeleteMessage('m-1') })
    expect(r.current.messages.map(m => m.id)).toEqual(['m-2'])
  })

  it('🔴 supprimer un ticket qui échoue : le ticket RESTE dans la liste', async () => {
    mockDeleteTicket.mockResolvedValue(ECHEC)
    const r = await monter(api => api.setTickets([{ id: 't-1' }, { id: 't-2' }]))

    await act(async () => { await r.current.handleDeleteTicket('t-1') })
    expect(r.current.tickets.map(t => t.id)).toEqual(['t-1', 't-2'])
  })

  it('supprimer un ticket qui réussit : il part', async () => {
    mockDeleteTicket.mockResolvedValue(SUCCES)
    const r = await monter(api => api.setTickets([{ id: 't-1' }, { id: 't-2' }]))

    await act(async () => { await r.current.handleDeleteTicket('t-1') })
    expect(r.current.tickets.map(t => t.id)).toEqual(['t-2'])
  })
})
