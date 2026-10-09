import { describe, it, expect } from 'vitest'
import { suggestUsername } from '@features/auth/lib/username-suggestion'

describe('suggestUsername', () => {
  it('utilise le prénom Google nettoyé', () => {
    expect(suggestUsername({ given_name: 'Jean' })).toBe('Jean')
  })
  it('prend le 1er mot de name et retire les accents', () => {
    expect(suggestUsername({ name: 'Élodie Martin' })).toBe('Elodie')
  })
  it('retombe sur Chef-xxxx (4 derniers chiffres du seed) si pas de prénom', () => {
    expect(suggestUsername({}, 'uuid-9871234')).toBe('Chef-1234')
  })
  it('retombe sur Chef-xxxx si le prénom nettoyé fait moins de 3 caractères', () => {
    expect(suggestUsername({ given_name: 'Al' }, 'x99')).toBe('Chef-0099')
  })
})
