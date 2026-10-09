import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const mockInsert  = vi.hoisted(() => vi.fn())
const mockFrom    = vi.hoisted(() => vi.fn(() => ({ insert: mockInsert })))
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: { getUser: mockGetUser },
  },
}))

import { logAuditAction, AUDIT_ACTIONS, AUDIT_TARGET_TYPES, __test__ } from '@features/admin/lib/audit'

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

// ─── filterMetadata (unit pur) ───────────────────────────────────────────────

describe('audit.filterMetadata', () => {
  const { filterMetadata } = __test__

  it('garde les clés whitelistées pour une action donnée', () => {
    const result = filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, { reason: 'spam' })
    expect(result).toEqual({ reason: 'spam' })
  })

  it('filtre les clés non whitelistées (RGPD : pas de fuite email/IP)', () => {
    const result = filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, {
      reason: 'spam',
      email:  'leak@example.com',
      ip:     '1.2.3.4',
      token:  'secret-token',
    })
    expect(result).toEqual({ reason: 'spam' })
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('ip')
    expect(result).not.toHaveProperty('token')
  })

  it('retourne null si aucune clé valide n\'est présente', () => {
    expect(
      filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, { email: 'leak@example.com' })
    ).toBeNull()
  })

  it('retourne null pour une action sans clés autorisées', () => {
    expect(
      filterMetadata(AUDIT_ACTIONS.RECIPE_APPROVED, { foo: 'bar' })
    ).toBeNull()
  })

  it('retourne null si metadata est absent ou non-objet', () => {
    expect(filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, null)).toBeNull()
    expect(filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, undefined)).toBeNull()
    expect(filterMetadata(AUDIT_ACTIONS.RECIPE_REJECTED, 'string')).toBeNull()
  })
})

// ─── logAuditAction (intégration mockée) ─────────────────────────────────────

describe('audit.logAuditAction', () => {
  it('insère une row valide dans activity_logs', async () => {
    await logAuditAction(AUDIT_ACTIONS.RECIPE_REJECTED, {
      targetId:   'recipe-42',
      targetType: AUDIT_TARGET_TYPES.RECIPE,
      metadata:   { reason: 'spam' },
    })
    expect(mockFrom).toHaveBeenCalledWith('activity_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      user_id:     'user-1',
      action:      'recipe_rejected',
      target_id:   'recipe-42',
      target_type: 'recipe',
      metadata:    { reason: 'spam' },
    })
  })

  it('retourne une erreur "Not authenticated" sans utilisateur', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { error } = await logAuditAction(AUDIT_ACTIONS.RECIPE_REJECTED)
    expect(error.message).toBe('Not authenticated')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('omet metadata du row si aucune clé n\'est whitelistée', async () => {
    await logAuditAction(AUDIT_ACTIONS.RECIPE_APPROVED, {
      targetId: 'recipe-42',
      metadata: { foo: 'bar', reason: 'whatever' },
    })
    const insertedRow = mockInsert.mock.calls[0][0]
    expect(insertedRow.metadata).toBeUndefined()
  })

  it('warn en dev sur action inconnue mais insère quand même', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await logAuditAction('action_inconnue', { targetId: 'x' })
    expect(mockInsert).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('convertit targetId en string', async () => {
    await logAuditAction(AUDIT_ACTIONS.RECIPE_DELETED, { targetId: 42 })
    expect(mockInsert.mock.calls[0][0].target_id).toBe('42')
  })
})
