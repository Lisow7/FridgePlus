import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { memeSecret } from '../../../supabase/functions/_shared/secrets.ts'
import { reponseErreur } from '../../../supabase/functions/_shared/reponse-erreur.ts'
import { runAfterResponse } from '../../../supabase/functions/_shared/apres-reponse.ts'

// Audit du 2026-10-04, lot « fonctions edge durcies » (BDD-18 (1) (2) (3) (5) (6), SEC-09,
// SEC-05 = BDD-17). Les fonctions edge ne tournent pas dans la CI : la logique pure est
// importée ici, le reste est lu dans le source (sans les commentaires).

const lire = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')
const sansCommentaires = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const DOSSIER = resolve(process.cwd(), 'supabase/functions')
const FONCTIONS = readdirSync(DOSSIER).filter((n) => !n.startsWith('_')).sort()
const source = (nom) => sansCommentaires(lire(`supabase/functions/${nom}/index.ts`))

afterEach(() => { vi.restoreAllMocks(); delete globalThis.EdgeRuntime })

describe('memeSecret : une comparaison qui ne s’arrête pas au premier octet différent', () => {
  it('égaux → vrai ; différents de même longueur → faux ; longueurs différentes → faux ; vide → faux', () => {
    expect(memeSecret('abc-123', 'abc-123')).toBe(true)
    expect(memeSecret('abc-123', 'abc-124')).toBe(false)
    expect(memeSecret('abc-123', 'abc-12')).toBe(false)
    expect(memeSecret('', '')).toBe(false)
    expect(memeSecret('x', '')).toBe(false)
  })
  it('compare tous les octets, pas seulement jusqu’au premier écart (prouvé par le compte de XOR)', () => {
    // Deux chaînes qui diffèrent au premier caractère : une comparaison
    // paresseuse s'arrêterait là ; la nôtre lit tout — la même longueur de
    // travail quel que soit l'écart (pas de chronométrage ici : la forme suffit).
    const src = sansCommentaires(lire('supabase/functions/_shared/secrets.ts'))
    expect(src).toMatch(/ecart \|= a\[i\] \^ b\[i\]/)
    expect(src).toMatch(/return ecart === 0/)
    // Aucune sortie anticipée DANS la boucle (une seule ligne, sans return).
    expect(src).not.toMatch(/for \([^)]*\)[^\n]*return/)
  })
})

describe('reponseErreur : un code pour le client, la cause au journal seulement', () => {
  it('renvoie { error: code } et rien d’autre, avec le statut et les en-têtes', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = reponseErreur('db_error', 500, { 'Access-Control-Allow-Origin': 'https://fridgeplus.app' }, { message: 'relation "x" does not exist', code: '42P01' }, 'test')
    expect(r.status).toBe(500)
    expect(r.headers.get('Content-Type')).toBe('application/json')
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://fridgeplus.app')
    expect(await r.json()).toEqual({ error: 'db_error' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0].join(' ')).toMatch(/\[test\] db_error.*does not exist/)
  })
  it('sans cause : rien au journal ; des champs publics peuvent s’ajouter (status d’OpenAI, max)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = reponseErreur('openai_error', 502, {}, undefined, 'test', { status: 429 })
    expect(await r.json()).toEqual({ error: 'openai_error', status: 429 })
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('runAfterResponse : une écriture après la réponse, jamais perdue, jamais bloquante', () => {
  it('avec EdgeRuntime.waitUntil : la promesse lui est confiée', () => {
    const waitUntil = vi.fn()
    globalThis.EdgeRuntime = { waitUntil }
    runAfterResponse(Promise.resolve('ok'))
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })
  it('sans EdgeRuntime : un rejet est avalé, pas de rejet non géré', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runAfterResponse(Promise.reject(new Error('boum')))
    await new Promise((r) => setTimeout(r, 0))
    expect(warn).toHaveBeenCalled()
  })
})

describe('aucune fonction ne renvoie ses erreurs brutes au client (BDD-18 (1) (2), SEC-09)', () => {
  it.each(FONCTIONS)('%s : pas de « detail » dans une réponse, pas de message dans les détails d’erreur', (nom) => {
    const src = source(nom)
    expect(src, `${nom} : detail dans une réponse`).not.toMatch(/JSON\.stringify\(\{[^}]*\bdetail\s*:/)
    expect(src, `${nom} : message brut dans errorDetails`).not.toMatch(/reason:\s*`[^`]*\$\{[^}]*(message|error)\b[^}]*\}/)
    expect(src, `${nom} : username renvoyé dans une erreur`).not.toMatch(/errors\.push\(\{[^}]*username/)
  })
})

describe('les secrets se comparent en temps constant (BDD-18 (3))', () => {
  const AVEC_SECRET = ['purge-soft-deleted-accounts', 'notify-inactive', 'send-push-notification', 'send-leftover-expiry-push', 'send-weekly-metrics-digest']
  it.each(AVEC_SECRET)('%s importe memeSecret et n’utilise plus === sur un secret', (nom) => {
    const src = source(nom)
    expect(src).toMatch(/import \{ memeSecret \} from '\.\.\/_shared\/secrets\.ts'/)
    expect(src).not.toMatch(/provided\s*!==\s*expectedSecret|cronSecretHeader\s*===\s*cronSecretEnv|authHeader\s*===\s*`Bearer/)
  })
})

describe('moderate-content : le cache et le journal s’écrivent vraiment, et ne gardent que le verdict (BDD-18 (5) (6))', () => {
  const src = source('moderate-content')
  it('plus d’écriture en void : tout passe par runAfterResponse', () => {
    expect(src).not.toMatch(/void supabaseAdmin/)
    expect(src).toMatch(/import \{ runAfterResponse \} from '\.\.\/_shared\/apres-reponse\.ts'/)
  })
  it('le cache ne garde que le verdict, jamais le post créé ; la photo est créée même sur un cache atteint', () => {
    expect(src).toMatch(/response:\s*verdict/)
    expect(src).not.toMatch(/response:\s*cleanResult/)
  })
  it('une photo déposée dont le post échoue est retirée du bucket', () => {
    expect(src).toMatch(/\.from\('review-photos'\)\s*\.remove\(\[/)
  })
})

describe('restore-account : le jeton est validé avant la requête', () => {
  it('un jeton qui n’a pas la forme d’un UUID est refusé sans toucher à la base', () => {
    const src = source('restore-account')
    const i = src.search(/\[0-9a-f\]\{8\}-/)
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(src.indexOf("from('profiles')"))
  })
})

describe('crons Vercel : secret exigé, comparé en temps constant, sans corps brut renvoyé (SEC-05, BDD-17)', () => {
  it('l’aide partagée exige le secret et compare en temps constant', () => {
    const src = sansCommentaires(lire('api/_lib/secret-de-cron.js'))
    expect(src).toMatch(/timingSafeEqual/)
    expect(src).toMatch(/if \(!secret\) return false/)
    expect(src).toMatch(/propose\.length === attendu\.length/)
  })
  it.each(['api/cron/quality-check.js', 'api/cron/notify-inactive.js'])('%s passe par l’aide, sans corps brut renvoyé', (chemin) => {
    const src = sansCommentaires(lire(chemin))
    expect(src).toMatch(/import \{ secretAccepte \} from '\.\.\/_lib\/secret-de-cron\.js'/)
    expect(src).toMatch(/if \(!secretAccepte\(/)
    expect(src).not.toMatch(/authHeader\s*!==\s*`Bearer/)
    expect(src).not.toMatch(/\.json\(\{[^}]*\b(body|detail)\s*:/)
  })
})
