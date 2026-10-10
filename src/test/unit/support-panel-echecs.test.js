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

const mockCreateTicket  = vi.hoisted(() => vi.fn())
const mockCreateReport  = vi.hoisted(() => vi.fn())
const mockDeleteMessage = vi.hoisted(() => vi.fn())
const mockDeleteTicket  = vi.hoisted(() => vi.fn())
const mockUpdateTitle   = vi.hoisted(() => vi.fn())
const mockGetMessages   = vi.hoisted(() => vi.fn(() => Promise.resolve({ messages: [], error: null })))
const mockMarkRead      = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
const mockSend          = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))

vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn().mockResolvedValue([]),
  getTicketMessages: (...a) => mockGetMessages(...a),
  createTicket: (...a) => mockCreateTicket(...a),
  sendUserMessage: (...a) => mockSend(...a),
  markTicketReadByUser: (...a) => mockMarkRead(...a),
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
vi.mock('@shared/api/reports', () => ({ createReport: (...a) => mockCreateReport(...a) }))
vi.mock('@shared/api/moderation-de-contenu', () => ({ moderateContent: vi.fn().mockResolvedValue({ flagged: false }) }))

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

  // 2026-10-05 : la base refuse désormais un compte banni ou supprimé avec un
  // motif à part (`account_restricted`), au lieu du refus générique qui
  // s'affichait « Limite de 3 tickets ouverts atteinte ».
  it('compte restreint : le formulaire le dit, et à qui écrire — pas « limite de 3 tickets »', async () => {
    mockCreateTicket.mockResolvedValue({ error: { message: 'account_restricted' }, data: null })
    const r = await monter(api => api.setNewFlow({
      category: { id: 'question', flow: 'free', ticketType: 'question' },
      target: null, searchQuery: '', searchResults: [], searchLoading: false,
      reasonKey: '', details: 'Pourquoi mon compte est-il bloqué ?', freeTitle: 'Mon compte',
    }))
    await act(async () => { await r.current.handleSubmit() })
    expect(r.current.error).toMatch(/support@fridgeplus\.app/)
    expect(r.current.error).not.toMatch(/Limite/)
  })

  it('compte restreint, sur un signalement : même message', async () => {
    mockCreateReport.mockResolvedValue({ error: { message: 'account_restricted' } })
    const r = await monter(api => api.setNewFlow({
      category: { id: 'report_recipe', flow: 'report', targetType: 'recipe', group: 'report' },
      target: { id: 'r-1', label: 'Pâtes', emoji: '🍝' }, searchQuery: '', searchResults: [], searchLoading: false,
      reasonKey: 'spam', details: '', freeTitle: '',
    }))
    await act(async () => { await r.current.handleSubmit() })
    expect(r.current.error).toMatch(/support@fridgeplus\.app/)
  })

  // CPT-17 : les signalements ont leur propre plafond (10), dit comme tel.
  it('plafond de signalements, sur un signalement : le formulaire le dit — pas « limite de 3 tickets »', async () => {
    mockCreateReport.mockResolvedValue({ error: { message: 'max_reports_reached' } })
    const r = await monter(api => api.setNewFlow({
      category: { id: 'report_recipe', flow: 'report', targetType: 'recipe', group: 'report' },
      target: { id: 'r-1', label: 'Pâtes', emoji: '🍝' }, searchQuery: '', searchResults: [], searchLoading: false,
      reasonKey: 'spam', details: '', freeTitle: '',
    }))
    await act(async () => { await r.current.handleSubmit() })
    expect(r.current.error).toMatch(/10 signalements/)
    expect(r.current.error).not.toMatch(/3 tickets/)
  })

  it('supprimer un ticket qui réussit : il part', async () => {
    mockDeleteTicket.mockResolvedValue(SUCCES)
    const r = await monter(api => api.setTickets([{ id: 't-1' }, { id: 't-2' }]))

    await act(async () => { await r.current.handleDeleteTicket('t-1') })
    expect(r.current.tickets.map(t => t.id)).toEqual(['t-2'])
  })
})

// Audit du 2026-10-04, ADM-08 — côté utilisateur. Les messages d'un ticket qui
// n'ont pas pu être lus s'affichaient comme un fil vide, sans un mot ; et la
// pastille « non lu » baissait sans savoir si la base avait marqué le ticket.
describe('Panneau support — ouvrir un ticket', () => {
  const TICKET = { id: 't-1', title: 'Mon frigo', status: 'open', has_unread_user: true }

  beforeEach(() => {
    mockGetMessages.mockImplementation(() => Promise.resolve({ messages: [], error: null }))
    mockMarkRead.mockImplementation(() => Promise.resolve({ error: null }))
  })

  it('les messages n’ont pas pu être lus : c’est dit', async () => {
    mockGetMessages.mockImplementation(() => Promise.resolve({ messages: [], error: { message: 'Failed to fetch' } }))
    const r = await monter(() => {})
    await act(async () => { await r.current.openTicket(TICKET) })
    expect(r.current.error).toBe('Les messages n\'ont pas pu être chargés. Ferme puis rouvre le ticket.')
  })

  it('les messages sont lus : aucune erreur (témoin)', async () => {
    mockGetMessages.mockImplementation(() => Promise.resolve({ messages: [{ id: 'm-1' }], error: null }))
    const r = await monter(() => {})
    await act(async () => { await r.current.openTicket(TICKET) })
    expect(r.current.error).toBeNull()
    expect(r.current.messages).toEqual([{ id: 'm-1' }])
  })

  it('« lu » refusé par la base : la pastille ne baisse pas', async () => {
    mockMarkRead.mockImplementation(() => Promise.resolve({ error: { message: 'RLS refuse' } }))
    const onUnreadChange = vi.fn()
    const { result } = renderHook(() => useSupportPanel({ userId: 'u-1', lang: 'fr', onUnreadChange }))
    await act(async () => {})
    act(() => { result.current.setTickets([TICKET]) })
    await act(async () => { await result.current.openTicket(TICKET) })
    expect(onUnreadChange).not.toHaveBeenCalled()
    expect(result.current.tickets[0].has_unread_user).toBe(true)
  })

  it('répondre, puis la relecture échoue : le fil garde ses messages, et c’est dit', async () => {
    mockGetMessages.mockImplementation(() => Promise.resolve({ messages: [{ id: 'm-1' }], error: null }))
    const r = await monter(() => {})
    await act(async () => { await r.current.openTicket({ ...TICKET, has_unread_user: false }) })
    mockGetMessages.mockImplementation(() => Promise.resolve({ messages: [], error: { message: 'Failed to fetch' } }))
    act(() => { r.current.setReplyContent('Merci') })
    await act(async () => { await r.current.handleSendReply() })
    expect(r.current.messages).toEqual([{ id: 'm-1' }])
    expect(r.current.error).toBe('Les messages n\'ont pas pu être chargés. Ferme puis rouvre le ticket.')
  })

  it('« lu » accepté : la pastille baisse (témoin)', async () => {
    const onUnreadChange = vi.fn()
    const { result } = renderHook(() => useSupportPanel({ userId: 'u-1', lang: 'fr', onUnreadChange }))
    await act(async () => {})
    act(() => { result.current.setTickets([TICKET]) })
    await act(async () => { await result.current.openTicket(TICKET) })
    expect(onUnreadChange).toHaveBeenCalled()
    expect(result.current.tickets[0].has_unread_user).toBe(false)
  })
})
