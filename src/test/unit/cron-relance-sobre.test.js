import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Audit du 2026-10-04, SEC-05 (3) : la route du cron de relance renvoyait à
// son appelant — et recopiait dans les journaux Vercel — le détail des échecs
// de la fonction edge, identifiant de compte compris, et, en cas d'échec, le
// corps brut de la fonction. La fonction edge journalise déjà ces détails côté
// Supabase ; la route ne rend que des comptes et des motifs agrégés.

import handler from '../../../api/cron/notify-inactive.js'

function reponse() {
  const res = { statut: null, corps: null }
  res.status = (s) => { res.statut = s; return res }
  res.json = (c) => { res.corps = c; return res }
  return res
}
const requete = { headers: { authorization: 'Bearer secret-du-cron' } }

let journaux
beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'secret-du-cron')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemple.supabase.co')
  vi.stubEnv('NOTIFY_INACTIVE_CRON_SECRET', 'secret-supabase')
  journaux = []
  for (const niveau of ['log', 'warn', 'error']) {
    vi.spyOn(console, niveau).mockImplementation((...args) => { journaux.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('cron de relance — ce qui sort de la route', () => {
  it('succès : des comptes et des motifs agrégés, aucun identifiant de compte (réponse ni journaux)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ processed: 3, warned: 1, errors: 2, hasMore: false,
        errorDetails: [{ id: 'compte-a1', reason: 'resend_429' }, { id: 'compte-b2', reason: 'resend_429' }] }),
    })))
    const res = reponse()
    await handler(requete, res)
    expect(res.statut).toBe(200)
    expect(res.corps).toMatchObject({ ok: true, processed: 3, warned: 1, errors: 2, raisons: { resend_429: 2 } })
    expect(res.corps).not.toHaveProperty('errorDetails')
    expect(JSON.stringify(res.corps)).not.toMatch(/compte-a1|compte-b2/)
    expect(journaux.join('\n')).not.toMatch(/compte-a1|compte-b2/)
  })

  it('échec de la fonction edge : ni son corps brut, ni les détails, dans la réponse ou les journaux', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500,
      json: async () => ({ error: 'trace interne de la fonction', errorDetails: [{ id: 'compte-c3', reason: 'exception' }] }),
    })))
    const res = reponse()
    await handler(requete, res)
    expect(res.statut).toBe(502)
    expect(res.corps).toEqual({ error: 'edge_function_failed', status: 500 })
    expect(journaux.join('\n')).not.toMatch(/compte-c3|trace interne/)
  })

  it('sans le bon secret : 401, et la fonction edge n’est pas appelée (témoin)', async () => {
    const appel = vi.fn()
    vi.stubGlobal('fetch', appel)
    const res = reponse()
    await handler({ headers: { authorization: 'Bearer autre' } }, res)
    expect(res.statut).toBe(401)
    expect(appel).not.toHaveBeenCalled()
  })
})
