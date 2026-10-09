import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '@shared/lib/format-date'

// Le helper était recopié 8 fois, et les 17 occurrences codaient 'fr-FR' en
// dur : un administrateur anglophone lisait des dates françaises partout dans
// la console d'administration (audit 2026-08-28).
describe('formatDate / formatDateTime — suivent la langue', () => {
  const quandLe = '2026-08-28T14:30:00Z'

  it('rend un format différent en français et en anglais', () => {
    const fr = formatDate(quandLe, 'fr')
    const en = formatDate(quandLe, 'en')
    expect(fr).not.toBe(en)
    expect(fr).toMatch(/28/)
    expect(en).toMatch(/8/)
  })

  it('retombe sur le français pour une langue inconnue', () => {
    expect(formatDate(quandLe, 'xx')).toBe(formatDate(quandLe, 'fr'))
  })

  it('rend un tiret plutôt que « Invalid Date » sur une valeur absente ou illisible', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('pas une date')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })

  it('formatDateTime porte l’heure, formatDate non', () => {
    expect(formatDateTime(quandLe, 'fr')).toMatch(/\d{2}:\d{2}/)
    expect(formatDate(quandLe, 'fr')).not.toMatch(/\d{2}:\d{2}/)
  })
})
