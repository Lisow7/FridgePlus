import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { langueDuVisiteur } from '@shared/lib/i18n/langues'

// Décision du 2026-10-08 : la langue d’un premier visiteur est le français, tant
// que la personne n’a pas choisi — un anglophone change en un clic, et la page
// reste cohérente pour les moteurs (le HTML pré-rendu est en français : un robot
// au navigateur anglais lisait une page qui changeait de langue en s’hydratant).

let langueDuNavigateur
beforeEach(() => {
  localStorage.clear()
  langueDuNavigateur = vi.spyOn(navigator, 'language', 'get')
})
afterEach(() => { langueDuNavigateur.mockRestore(); localStorage.clear() })

describe('la langue d’un premier visiteur', () => {
  it('le français, même avec un navigateur en anglais, tant que rien n’est choisi', () => {
    langueDuNavigateur.mockReturnValue('en-US')
    expect(langueDuVisiteur()).toBe('fr')
  })

  it('le français aussi pour une langue que l’app ne propose pas', () => {
    langueDuNavigateur.mockReturnValue('de-DE')
    expect(langueDuVisiteur()).toBe('fr')
  })

  it('le choix enregistré l’emporte, dans les deux sens', () => {
    langueDuNavigateur.mockReturnValue('fr-FR')
    localStorage.setItem('fridge-lang', 'en')
    expect(langueDuVisiteur()).toBe('en')
    langueDuNavigateur.mockReturnValue('en-US')
    localStorage.setItem('fridge-lang', 'fr')
    expect(langueDuVisiteur()).toBe('fr')
  })

  it('un ancien réglage qui n’est plus proposé (es, de, ja) reste un choix non francophone : l’anglais', () => {
    localStorage.setItem('fridge-lang', 'es')
    expect(langueDuVisiteur()).toBe('en')
  })
})
