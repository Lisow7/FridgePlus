import { describe, it, expect, vi, beforeEach } from 'vitest'

// Audit du 2026-10-04, CPT-18 : la langue que lisent les e-mails de Supabase
// Auth (`{{ .Data.lang }}`) vit dans user_metadata. L'écriture ne doit jamais
// lever : le hook qui l'appelle ne l'attend pas.
const m = vi.hoisted(() => ({ updateUser: vi.fn(), logError: vi.fn() }))
vi.mock('@shared/lib/supabase/client', () => ({ supabase: { auth: { updateUser: m.updateUser } } }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: m.logError }))

import { retenirLaLangueDesEmails } from '@shared/api/langue-du-compte'

beforeEach(() => {
  m.updateUser.mockReset()
  m.logError.mockReset()
})

describe('retenirLaLangueDesEmails', () => {
  it('écrit la langue dans user_metadata, et seulement elle', async () => {
    m.updateUser.mockResolvedValue({ data: {}, error: null })
    expect(await retenirLaLangueDesEmails('en')).toEqual({ error: null })
    expect(m.updateUser).toHaveBeenCalledWith({ data: { lang: 'en' } })
    expect(m.logError).not.toHaveBeenCalled()
  })

  it('un refus du service s’écrit au journal et se rend', async () => {
    const refus = { message: 'refusé', status: 403 }
    m.updateUser.mockResolvedValue({ data: null, error: refus })
    expect(await retenirLaLangueDesEmails('en')).toEqual({ error: refus })
    expect(m.logError).toHaveBeenCalledWith(refus, { tag: 'langue.emails' })
  })

  it('une exception (réseau) ne s’échappe pas', async () => {
    m.updateUser.mockRejectedValue(new Error('Failed to fetch'))
    const res = await retenirLaLangueDesEmails('fr')
    expect(res.error).toBeInstanceOf(Error)
    expect(m.logError).toHaveBeenCalledWith(res.error, { tag: 'langue.emails' })
  })
})
