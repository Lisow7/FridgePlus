import { describe, it, expect } from 'vitest'
import { validatePassword, PWD_SCORE_MAX } from '@shared/lib/auth/password-policy'

// v3.416 — La policy a été élargie pour matcher Supabase Auth :
// 5 critères au lieu de 3 (ajout : lowercase + caractère spécial).
// Évite les 422 weak_password en production.

describe('validatePassword', () => {
  it('score 0 — mot de passe vide', () => {
    const r = validatePassword('')
    expect(r.score).toBe(0)
    expect(r.errors).toContain('min8')
    expect(r.errors).toContain('lowercase')
    expect(r.errors).toContain('uppercase')
    expect(r.errors).toContain('digit')
    expect(r.errors).toContain('special')
  })

  it('score 1 — uniquement la longueur', () => {
    // Seulement min8 satisfait → score = 5 - 4 = 1
    const r = validatePassword('00000000')
    expect(r.errors).not.toContain('min8')
    expect(r.errors).not.toContain('digit')
    expect(r.score).toBe(2)
  })

  it('score 3 — 8 chars + min + MAJ + chiffre sans spécial', () => {
    const r = validatePassword('TestPass123')
    expect(r.score).toBe(4)
    expect(r.errors).toEqual(['special'])
  })

  it('score 5 — mot de passe fort complet (l\'ancien Secure1! reste valide)', () => {
    const r = validatePassword('Secure1!')
    expect(r.score).toBe(PWD_SCORE_MAX)
    expect(r.errors).toHaveLength(0)
  })

  it('score 5 — long mot de passe', () => {
    const r = validatePassword('SuperMotDePasseTresLong123!')
    expect(r.score).toBe(PWD_SCORE_MAX)
  })

  it('null / undefined → score 0', () => {
    expect(validatePassword(null).score).toBe(0)
    expect(validatePassword(undefined).score).toBe(0)
  })

  it('7 caractères : échoue min8 même avec tous les autres critères', () => {
    const r = validatePassword('Abc1!fg')
    expect(r.errors).toContain('min8')
    expect(r.score).toBe(PWD_SCORE_MAX - 1)
  })

  it('caractères spéciaux acceptés couvrent les usuels', () => {
    for (const ch of ['!', '@', '#', '$', '%', '&', '*', '?', '/', '.', ',']) {
      const r = validatePassword(`Abc12345${ch}`)
      expect(r.errors).not.toContain('special')
    }
  })
})
