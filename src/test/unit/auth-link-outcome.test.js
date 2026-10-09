import { describe, it, expect } from 'vitest'
import { readAuthLinkParams, authLinkProblem, cleanAuthLinkUrl } from '@shared/lib/auth/auth-link-outcome'

// Audit du 2026-10-04, CPT-03. Un lien reçu par e-mail (confirmation,
// mot de passe oublié) ramène sur le site avec, dans l'adresse, soit un code à
// échanger, soit un motif d'échec. La bibliothèque d'authentification traite
// les deux SANS RIEN DIRE à l'application quand ça échoue : lien expiré, déjà
// utilisé, ou ouvert dans un autre navigateur que celui de la demande. La
// personne arrivait sur l'accueil, déconnectée, sans un mot.
const SITE = 'https://fridgeplus.app/'

describe('ce que l’adresse disait à l’arrivée', () => {
  it('rien de particulier', () => {
    expect(readAuthLinkParams(SITE)).toEqual({ hasCode: false, hasError: false, errorCode: null })
    expect(readAuthLinkParams(`${SITE}recipe/123?recettes=1#etapes`)).toEqual({ hasCode: false, hasError: false, errorCode: null })
  })

  it('un code à échanger (retour de lien e-mail ou de Google)', () => {
    expect(readAuthLinkParams(`${SITE}?code=abc-123`)).toMatchObject({ hasCode: true, hasError: false })
  })

  it('un lien expiré : le motif est dans la requête ET dans le fragment', () => {
    const url = `${SITE}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
      + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    expect(readAuthLinkParams(url)).toEqual({ hasCode: false, hasError: true, errorCode: 'otp_expired' })
  })

  it('un motif d’échec dans le fragment seulement', () => {
    expect(readAuthLinkParams(`${SITE}#error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user`))
      .toEqual({ hasCode: false, hasError: true, errorCode: 'unexpected_failure' })
  })

  it('un motif sans code d’erreur reste un échec', () => {
    expect(readAuthLinkParams(`${SITE}?error_description=Something+went+wrong`)).toMatchObject({ hasError: true, errorCode: null })
  })

  it('une ancre ordinaire n’est pas un échec', () => {
    expect(readAuthLinkParams(`${SITE}legal#terms`)).toMatchObject({ hasCode: false, hasError: false })
  })

  it('une adresse illisible ne casse rien', () => {
    expect(readAuthLinkParams('pas une adresse')).toEqual({ hasCode: false, hasError: false, errorCode: null })
  })
})

describe('ce qu’il faut dire à la personne', () => {
  const rien = { hasCode: false, hasError: false, errorCode: null }

  it('rien, s’il n’y avait rien dans l’adresse', () => {
    expect(authLinkProblem(rien, false)).toBeNull()
    expect(authLinkProblem(rien, true)).toBeNull()
  })

  it('rien, si le code a ouvert une session', () => {
    expect(authLinkProblem({ hasCode: true, hasError: false, errorCode: null }, true)).toBeNull()
  })

  it('« pas de session ici », si le code n’en a ouvert aucune (autre navigateur, code périmé)', () => {
    expect(authLinkProblem({ hasCode: true, hasError: false, errorCode: null }, false)).toBe('no-session')
  })

  it('« lien expiré », quand le service le dit', () => {
    expect(authLinkProblem({ hasCode: false, hasError: true, errorCode: 'otp_expired' }, false)).toBe('expired')
  })

  it('« lien expiré » même si une session existe déjà : le lien n’a rien fait', () => {
    expect(authLinkProblem({ hasCode: false, hasError: true, errorCode: 'otp_expired' }, true)).toBe('expired')
  })

  it('« échec », pour tout autre motif (Google refusé, erreur du serveur)', () => {
    expect(authLinkProblem({ hasCode: false, hasError: true, errorCode: 'unexpected_failure' }, false)).toBe('failed')
    expect(authLinkProblem({ hasCode: false, hasError: true, errorCode: null }, false)).toBe('failed')
  })
})

describe('nettoyer l’adresse une fois le message posé', () => {
  it('retire le code et les motifs, dans la requête et dans le fragment', () => {
    expect(cleanAuthLinkUrl(`${SITE}?code=abc&sb_flow_id=f1`)).toBe(SITE)
    expect(cleanAuthLinkUrl(`${SITE}?error=access_denied&error_code=otp_expired&error_description=x#error=access_denied&error_code=otp_expired&error_description=x`)).toBe(SITE)
  })

  it('garde tout le reste', () => {
    expect(cleanAuthLinkUrl(`${SITE}recipe/12?recovery=1&code=abc&shared=xyz`)).toBe(`${SITE}recipe/12?recovery=1&shared=xyz`)
    expect(cleanAuthLinkUrl(`${SITE}legal?code=abc#terms`)).toBe(`${SITE}legal#terms`)
  })

  it('ne touche pas une adresse sans rien à retirer', () => {
    expect(cleanAuthLinkUrl(`${SITE}recipe/12?recettes=1#etapes`)).toBe(`${SITE}recipe/12?recettes=1#etapes`)
  })
})
