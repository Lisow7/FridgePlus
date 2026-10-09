// Le client Supabase se construit SANS l'option `lock`, et la version de
// supabase-js installée est celle qui rend ce retrait sûr.
//
// ── Pourquoi ces deux tests vont ensemble ────────────────────────────────
// Le `lock: (_name, _timeout, fn) => fn()` posé en v3.379 (PR #474, mai 2026)
// corrigeait une vraie collision : le LockManager natif (`navigator.locks`)
// contre le double-mount StrictMode en build de production → « Lock … was
// released because another request stole it » → profil affiché « – » après
// chaque F5. Depuis @supabase/auth-js 2.107.0, un client construit sans `lock`
// n'acquiert PLUS AUCUN verrou (coordination « lockless », cf.
// node_modules/@supabase/auth-js/migrations/lockless-coordination.md) : la
// cause du bug de mai ne peut plus se produire, et l'option, désormais
// dépréciée, loggue un avertissement à chaque chargement de page.
//
// Retirer l'option n'est donc sûr QUE si la version installée est ≥ 2.107.0.
// Un downgrade du lockfile ramènerait le bug de mai sans qu'aucun test ne
// bouge — d'où le second test : la garantie ET sa précondition, ensemble.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}))

describe('client Supabase — coordination sans verrou', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('ne passe aucune option `lock` à createClient (et garde le flux PKCE)', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    await import('../../shared/lib/supabase/client.js')

    expect(createClient).toHaveBeenCalledTimes(1)
    const options = createClient.mock.calls[0][2]
    expect(options?.auth).toBeDefined()
    expect(options.auth).not.toHaveProperty('lock')
    expect(options.auth).not.toHaveProperty('lockAcquireTimeout')
    expect(options.auth.flowType).toBe('pkce')
  })

  it('installe une version de supabase-js où le chemin sans verrou est le défaut (≥ 2.107.0)', () => {
    const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'))
    const version = lock.packages['node_modules/@supabase/supabase-js']?.version
    expect(version, 'supabase-js absent du lockfile').toBeDefined()

    const [major, minor] = version.split('.').map(Number)
    const lockless = major > 2 || (major === 2 && minor >= 107)
    expect(
      lockless,
      `supabase-js ${version} : sous 2.107.0 le client acquiert navigator.locks ` +
        'et la collision StrictMode de mai 2026 revient — remettre le `lock` no-op ' +
        'ou remonter la dépendance.',
    ).toBe(true)
  })
})
