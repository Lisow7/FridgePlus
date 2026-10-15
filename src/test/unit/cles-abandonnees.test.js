import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { CLES_ABANDONNEES, effacerLesClesAbandonnees } from '@shared/lib/auth/cles-abandonnees'

// Décision du 2026-10-08 — « Se souvenir de moi » est retirée : elle
// gardait l'adresse e-mail EN CLAIR sur l'appareil. La case partie, l'adresse
// déjà écrite doit partir aussi — au démarrage, pour tous, sans attendre une
// visite de l'écran de connexion qu'un compte resté ouvert ne fait jamais.

beforeEach(() => { localStorage.clear() })

describe('les clés que l’application n’écrit plus', () => {
  it('l’adresse retenue en fait partie', () => {
    expect(CLES_ABANDONNEES).toContain('fridge-remember-email')
  })

  it('s’effacent, et le reste de l’appareil ne bouge pas', () => {
    localStorage.setItem('fridge-remember-email', 'bob@test.com')
    localStorage.setItem('fridge-lang', 'en')
    effacerLesClesAbandonnees()
    expect(localStorage.getItem('fridge-remember-email')).toBeNull()
    expect(localStorage.getItem('fridge-lang')).toBe('en')
  })

  it('un stockage refusé (navigation privée) ne casse rien', () => {
    const original = Storage.prototype.removeItem
    Storage.prototype.removeItem = () => { throw new Error('SecurityError') }
    try {
      expect(() => effacerLesClesAbandonnees()).not.toThrow()
    } finally {
      Storage.prototype.removeItem = original
    }
  })

  it('s’effacent au démarrage de l’application', () => {
    expect(readFileSync('src/main.jsx', 'utf8')).toMatch(/^effacerLesClesAbandonnees\(\)/m)
  })

  it('plus personne ne les écrit', () => {
    const page = readFileSync('src/features/auth/pages/login-page.jsx', 'utf8')
    for (const cle of CLES_ABANDONNEES) expect(page).not.toContain(cle)
  })
})
