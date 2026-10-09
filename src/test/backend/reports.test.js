import { describe, it, expect, vi, beforeEach } from 'vitest'

// Symétrique du test équivalent dans `support.test.js`. Les DEUX points d'appel
// insèrent dans `support_tickets` et sont donc soumis au même plafond porté par
// la policy RLS (migration `20260812_plafond_serveur_tickets_ouverts.sql`) :
// couvrir un seul des deux laisserait la moitié du correctif sans preuve.

const mockFrom = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: mockFrom, auth: { getUser: mockGetUser } },
}))

vi.mock('@shared/lib/recipes/recipes-repository', () => ({
  findCommunityRecipeTitlesByIds: vi.fn().mockResolvedValue({}),
  findOfficialRecipeNamesByIds:   vi.fn().mockResolvedValue({}),
}))

import { createReport } from '@shared/api/reports'

function chain(returnValue) {
  const c = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
  }
  c[Symbol.toStringTag] = 'Promise'
  c.then  = (res, rej) => Promise.resolve(returnValue).then(res, rej)
  c.catch = (rej)      => Promise.resolve(returnValue).catch(rej)
  return c
}

const SIGNALEMENT = {
  targetType: 'recipe',
  targetId:   'r-1',
  reasonKey:  'spam',
}

describe('Backend — reports.js : plafond de tickets ouverts', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockGetUser.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('refuse côté client dès 3 tickets ouverts, sans appeler la base', async () => {
    mockFrom.mockReturnValue(chain({ count: 3, error: null }))
    const { error } = await createReport(SIGNALEMENT)
    expect(error?.message).toBe('max_tickets_reached')
  })

  // Le compteur client passe, mais la policy RLS refuse : deux signalements
  // envoyés en même temps. Sans traduction, l'utilisateur verrait
  // « new row violates row-level security policy ».
  it('traduit le refus 42501 de la policy RLS en max_tickets_reached', async () => {
    const countChain  = chain({ count: 2, error: null })
    const insertChain = {
      ...chain(null),
      single: vi.fn().mockResolvedValue({
        data:  null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      }),
    }
    mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)
    const { error } = await createReport(SIGNALEMENT)
    expect(error?.message).toBe('max_tickets_reached')
  })

  it('laisse passer une autre erreur Postgres telle quelle', async () => {
    const countChain  = chain({ count: 0, error: null })
    const insertChain = {
      ...chain(null),
      single: vi.fn().mockResolvedValue({
        data:  null,
        error: { code: '23505', message: 'duplicate key' },
      }),
    }
    mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)
    const { error } = await createReport(SIGNALEMENT)
    expect(error?.message).toBe('duplicate key')
  })
})
