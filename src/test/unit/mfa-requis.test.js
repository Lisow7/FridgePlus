import { describe, it, expect } from 'vitest'
import { mfaRequis, facteurAVerifier } from '@shared/lib/auth/mfa-requis'

// Le code de double authentification est-il dû pour CETTE session ? (audit du
// 2026-10-04, CPT-01.)
//
// Calcul SYNCHRONE, depuis la session que supabase-js remet à
// `onAuthStateChange` : le claim `aal` du jeton, et les facteurs vérifiés de
// `session.user`. C'est ce que fait `getAuthenticatorAssuranceLevel`, en
// asynchrone — l'attendre aurait laissé l'application visible quelques images
// avant la porte. Fermé par défaut : un jeton illisible, avec un facteur
// vérifié, exige le code.

const encoder = (objet) => btoa(JSON.stringify(objet)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jeton = (charge) => `${encoder({ alg: 'HS256' })}.${encoder(charge)}.signature`
const VERIFIE = { id: 'f1', factor_type: 'totp', status: 'verified' }
const EN_COURS = { id: 'f0', factor_type: 'totp', status: 'unverified' }
const session = ({ aal = 'aal1', factors = [VERIFIE], access_token } = {}) => ({
  access_token: access_token ?? jeton({ sub: 'u-1', aal }),
  user: { id: 'u-1', factors },
})

describe('mfaRequis', () => {
  it('sans session : rien à demander', () => {
    expect(mfaRequis(null)).toBe(false)
    expect(mfaRequis({ user: null })).toBe(false)
  })

  it('compte sans double authentification : rien à demander', () => {
    expect(mfaRequis(session({ factors: [] }))).toBe(false)
    expect(mfaRequis({ access_token: jeton({ aal: 'aal1' }), user: { id: 'u-1' } })).toBe(false)
  })

  it('facteur seulement en cours d’activation : rien à demander', () => {
    expect(mfaRequis(session({ factors: [EN_COURS] }))).toBe(false)
  })

  it('facteur vérifié, session au mot de passe seul (aal1) : le code est dû', () => {
    expect(mfaRequis(session({ aal: 'aal1' }))).toBe(true)
  })

  it('facteur vérifié, code déjà donné (aal2) : rien à demander', () => {
    expect(mfaRequis(session({ aal: 'aal2' }))).toBe(false)
  })

  it('jeton illisible avec un facteur vérifié : le code est dû (fermé par défaut)', () => {
    expect(mfaRequis(session({ access_token: 'pas-un-jeton' }))).toBe(true)
    expect(mfaRequis(session({ access_token: null }))).toBe(true)
  })
})

describe('facteurAVerifier', () => {
  it('le premier facteur TOTP vérifié', () => {
    expect(facteurAVerifier(session({ factors: [EN_COURS, VERIFIE] }))).toBe('f1')
  })

  it('un facteur « phone » vérifié avant lui : c’est le TOTP qu’on défie (l’écran demande le code de l’application)', () => {
    const telephone = { id: 'p1', factor_type: 'phone', status: 'verified' }
    expect(facteurAVerifier(session({ factors: [telephone, VERIFIE] }))).toBe('f1')
  })

  it('aucun : null', () => {
    expect(facteurAVerifier(session({ factors: [EN_COURS] }))).toBeNull()
    expect(facteurAVerifier(null)).toBeNull()
  })
})
