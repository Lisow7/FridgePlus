import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook, act } from '@testing-library/react'
import { getLegalSection } from '@features/legal/data/legal-content'

// Audit du 2026-10-04, RGPD-02 ; décision du 2026-10-06 (OpenAI). Le texte
// d'une demande au support partait chez OpenAI pour modération, alors que la
// politique n'annonçait que « le texte public », sans contrat de sous-traitance
// signé. Une demande est privée : elle ne part plus.
//
// Et pas de filtre de mots à la place : un signalement CITE l'abus qu'il
// signale (« il m'a traité de … »). Le bloquer empêcherait justement de
// signaler. Le support est lu par l'équipe ; les plafonds (3 demandes,
// 10 signalements) et le bannissement tiennent les abus.

const mockModerer      = vi.hoisted(() => vi.fn())
const mockCreateTicket = vi.hoisted(() => vi.fn())
const mockCreateReport = vi.hoisted(() => vi.fn())

vi.mock('@shared/hooks/use-moderation', () => ({ moderateContent: (...a) => mockModerer(...a) }))
vi.mock('@features/support/api/support', () => ({
  getUserTickets: vi.fn().mockResolvedValue([]),
  getTicketMessages: vi.fn().mockResolvedValue({ messages: [], error: null }),
  createTicket: (...a) => mockCreateTicket(...a),
  sendUserMessage: vi.fn(), markTicketReadByUser: vi.fn().mockResolvedValue({ error: null }),
  deleteUserMessage: vi.fn(), deleteUserTicket: vi.fn(), updateTicketTitle: vi.fn(),
  searchBaseRecipes: vi.fn(), searchCommunityRecipes: vi.fn(),
  searchIngredients: vi.fn(), searchUsersForReport: vi.fn(),
}))
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }))
vi.mock('@shared/api/reports', () => ({ createReport: (...a) => mockCreateReport(...a) }))

import useSupportPanel from '@features/support/hooks/use-support-panel'

async function envoyer(flux) {
  const { result } = renderHook(() => useSupportPanel({ userId: 'u-1', lang: 'fr' }))
  await act(async () => {})
  act(() => { result.current.setNewFlow({ searchQuery: '', searchResults: [], searchLoading: false, ...flux }) })
  await act(async () => { await result.current.handleSubmit() })
  return result
}

beforeEach(() => {
  // Si le panneau appelait encore la modération, elle refuserait tout.
  mockModerer.mockReset().mockResolvedValue({ flagged: true })
  mockCreateTicket.mockReset().mockResolvedValue({ data: { id: 't-1' }, error: null })
  mockCreateReport.mockReset().mockResolvedValue({ data: { id: 'rp-1' }, error: null })
})

describe('une demande au support ne part pas chez OpenAI', () => {
  it('une question : envoyée telle quelle, sans passer par la modération', async () => {
    const r = await envoyer({
      category: { id: 'question', flow: 'free', ticketType: 'question' }, target: null,
      reasonKey: '', details: 'Ma recette a disparu après la mise à jour', freeTitle: 'Recette perdue',
    })
    expect(mockModerer).not.toHaveBeenCalled()
    expect(mockCreateTicket).toHaveBeenCalledWith('u-1', expect.objectContaining({ message: 'Ma recette a disparu après la mise à jour' }))
    expect(r.current.error).toBeNull()
  })

  it('un signalement qui cite l’insulte reçue passe : c’est ce qu’il signale', async () => {
    const r = await envoyer({
      category: { id: 'report_user', flow: 'report', targetType: 'user', group: 'report' },
      target: { id: 'p-1', label: 'quelqu’un', emoji: '👤' },
      reasonKey: 'harassment', details: 'Il m’a écrit « connard » sous ma recette', freeTitle: '',
    })
    expect(mockModerer).not.toHaveBeenCalled()
    expect(mockCreateReport).toHaveBeenCalledWith(expect.objectContaining({ reasonDetails: 'Il m’a écrit « connard » sous ma recette' }))
    expect(r.current.error).toBeNull()
  })
})

describe('la politique le dit', () => {
  it('fr et en : les demandes au support ne sont jamais transmises à OpenAI', () => {
    expect(JSON.stringify(getLegalSection('fr', 'privacy'))).toMatch(/Les demandes au support ne lui sont jamais transmises/)
    expect(JSON.stringify(getLegalSection('en', 'privacy'))).toMatch(/Support requests are never sent to it/)
  })

  // Les photos d'un avis ou d'un message de la communauté partent aussi à la
  // modération (`submitPhotoPost`, image en base64) : la politique ne parlait
  // que du texte.
  it('fr et en : les photos publiques partent aussi à la modération', () => {
    expect(JSON.stringify(getLegalSection('fr', 'privacy'))).toMatch(/Le texte et les photos publics soumis sont transmis pour analyse/)
    expect(JSON.stringify(getLegalSection('en', 'privacy'))).toMatch(/The submitted public text and photos are sent for analysis/)
  })
})

// Lot 14e (complément) : plus aucun écran n'envoie `ticket`, mais la fonction
// edge l'acceptait encore — un appel direct aurait fait partir le texte d'une
// demande chez OpenAI. Les fonctions edge ne tournent pas dans la CI : la
// liste est lue dans le source (cf. quotas-par-compte.test.js).
describe('le serveur non plus', () => {
  it('la modération n’accepte que des textes publics', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/functions/moderate-content/index.ts'), 'utf8')
    const liste = source.match(/const ALLOWED_FEATURES = new Set\(\[([^\]]*)\]\)/)
    expect(liste).not.toBeNull()
    expect(liste[1].match(/'[^']+'/g)).toEqual(["'recipe'", "'profile-bio'", "'review'", "'community-post'"])
  })
})
