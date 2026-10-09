import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getClientIp } from '../../../supabase/functions/_shared/rate-limit.ts'
import { reserverUnEmail, EMAILS_PAR_JOUR } from '../../../supabase/functions/_shared/email-quota.ts'

// Audit du 2026-10-04, BDD-08 : des quotas partagés épuisables par un seul
// compte. Le scan de ticket comptait 1 000 scans par mois pour TOUTE l'app (un
// compte les épuisait en deux heures, et le scan répondait « quota atteint » à
// tout le monde jusqu'au mois suivant) ; les e-mails de compte n'avaient qu'un
// limiteur en mémoire d'instance ; la clé des appels anonymes était la
// première valeur de X-Forwarded-For, que l'appelant choisit.
//
// Les fonctions edge ne tournent pas dans la CI : la logique pure est importée
// ici, le reste est lu dans le source (sans les commentaires, cf.
// quota-vision-branche.test.js).

const lire = (chemin) => readFileSync(resolve(process.cwd(), chemin), 'utf8')
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
}
const requete = (entetes) => new Request('https://exemple.test/fn', { headers: entetes })

describe('Limiteur : la clé d\'un appel anonyme ne se choisit pas', () => {
  it('cf-connecting-ip passe avant X-Forwarded-For, que l\'appelant peut préfixer', () => {
    expect(getClientIp(requete({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1', 'cf-connecting-ip': '5.6.7.8' }))).toBe('5.6.7.8')
  })
  it('sans cf-connecting-ip : x-real-ip', () => {
    expect(getClientIp(requete({ 'x-forwarded-for': '6.6.6.6', 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })
  it('X-Forwarded-For seul : la DERNIÈRE adresse (posée par le proxy), pas la première', () => {
    expect(getClientIp(requete({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4' }))).toBe('1.2.3.4')
  })
  it('rien : « unknown »', () => {
    expect(getClientIp(requete({}))).toBe('unknown')
  })
})

describe('Scan de ticket : un plafond PAR COMPTE, avant l\'appel à Google', () => {
  const code = sansCommentaires(lire('supabase/functions/scan-receipt/index.ts'))

  it('déclare un plafond mensuel par compte', () => {
    expect(code).toMatch(/const\s+USER_MONTHLY_QUOTA\s*=\s*\d+/)
  })

  it('compte les scans du mois de CE compte, et refuse au-delà', () => {
    expect(code).toMatch(/eq\(\s*'user_id'\s*,\s*user\.id\s*\)/)
    expect(code).toMatch(/>=\s*USER_MONTHLY_QUOTA/)
    expect(code).toMatch(/user_quota_exceeded/)
  })

  it('l\'ordre : compter, refuser, puis seulement appeler Google', () => {
    const posComptage = code.search(/eq\(\s*'user_id'\s*,\s*user\.id\s*\)/)
    const posRefus = code.indexOf('user_quota_exceeded')
    const posVision = code.search(/vision\.googleapis\.com|images:annotate/)
    expect(posComptage).toBeGreaterThan(-1)
    expect(posComptage).toBeLessThan(posRefus)
    expect(posRefus).toBeLessThan(posVision)
  })

  it('un comptage qui échoue refuse (comme le plafond global)', () => {
    const bloc = code.slice(code.search(/eq\(\s*'user_id'\s*,\s*user\.id\s*\)/), code.indexOf('user_quota_exceeded'))
    expect(bloc).toMatch(/quota_check_failed/)
  })

  it('l\'écran connaît chaque code d\'erreur que la fonction peut rendre (sinon : « scan_failed » muet)', () => {
    const codesServeur = [...new Set([...code.matchAll(/error:\s*'([a-z_]+)'/g)].map((m) => m[1]))]
    const flux = lire('src/app/hooks/use-receipt-scan-flow.js')
    const connus = flux.slice(flux.indexOf('const ERROR_CODES'), flux.indexOf('])', flux.indexOf('const ERROR_CODES')))
    expect(codesServeur.length).toBeGreaterThan(5)
    expect(codesServeur.filter((c) => !connus.includes(`'${c}'`))).toEqual([])
  })

  it('le message de l\'écran donne le même plafond que la fonction, dans chaque langue', () => {
    const plafond = code.match(/const\s+USER_MONTHLY_QUOTA\s*=\s*(\d+)/)[1]
    const ecran = lire('src/app/components/receipt-scan-overlays.jsx')
    const ligne = ecran.split('\n').find((l) => l.includes('user_quota_exceeded:'))
    expect(ligne).toBeDefined()
    for (const langue of ['fr', 'en']) {
      const message = ligne.match(new RegExp(`${langue}:\\s*'([^']*)'`))?.[1]
      expect(message, `message ${langue} absent`).toBeDefined()
      expect(message.match(/\d+/g), `message ${langue}`).toContain(plafond)
    }
  })
})

describe('E-mails de compte : un plafond quotidien par compte, tenu en base', () => {
  const admin = (reponse) => ({ rpc: vi.fn(() => Promise.resolve(reponse)) })

  it('réserve un e-mail par la base (fonction reserver_un_email)', async () => {
    const a = admin({ data: true, error: null })
    expect(await reserverUnEmail(a, 'u-1', 'profile_change')).toBe('ok')
    expect(a.rpc).toHaveBeenCalledWith('reserver_un_email', { p_user_id: 'u-1', p_kind: 'profile_change', p_max_par_jour: EMAILS_PAR_JOUR })
  })
  it('plafond atteint : « plafond »', async () => {
    expect(await reserverUnEmail(admin({ data: false, error: null }), 'u-1', 'profile_change')).toBe('plafond')
  })
  it('base injoignable : « erreur » (l\'appelant décide, il ne passe pas en silence)', async () => {
    expect(await reserverUnEmail(admin({ data: null, error: { message: 'boom' } }), 'u-1', 'profile_change')).toBe('erreur')
    expect(await reserverUnEmail({ rpc: () => Promise.reject(new Error('réseau')) }, 'u-1', 'profile_change')).toBe('erreur')
  })

  it.each([
    ['send-profile-change-notification', 'profile_change'],
    ['delete-account', 'account_deleted'],
  ])('%s réserve son e-mail AVANT de l\'envoyer', (fonction, sorte) => {
    const code = sansCommentaires(lire(`supabase/functions/${fonction}/index.ts`))
    const posReserve = code.search(new RegExp(`reserverUnEmail\\(\\s*supabaseAdmin\\s*,\\s*user\\.id\\s*,\\s*'${sorte}'\\s*\\)`))
    const posEnvoi = code.search(/sendEmail\(/)
    expect(posReserve).toBeGreaterThan(-1)
    expect(posReserve).toBeLessThan(posEnvoi)
  })

  it('le changement de profil refuse au-delà du plafond, et sur une base injoignable', () => {
    const code = sansCommentaires(lire('supabase/functions/send-profile-change-notification/index.ts'))
    expect(code).toMatch(/email_quota_exceeded/)
    expect(code).toMatch(/email_quota_check_failed/)
  })

  it('le changement de profil borne les valeurs qu\'il recopie dans l\'e-mail', () => {
    const code = sansCommentaires(lire('supabase/functions/send-profile-change-notification/index.ts'))
    expect(code).toMatch(/\.slice\(\s*0\s*,\s*254\s*\)/)
  })
})
