// Garde-fou i18n du panneau communauté.
//
// Deux invariants, tous deux issus de bugs réels :
//  1. Parité des clés — une clé oubliée dans un bloc de langue rend `t.xxx`
//     `undefined` côté affichage (libellé vide), sans que rien ne le signale.
//  2. Blocs complets uniquement — `community-page.jsx` résout la langue avec
//     `COMMUNITY_I18N[lang] ?? COMMUNITY_I18N.fr`. Tant qu'une langue est
//     absente, elle retombe proprement sur le français. Mais un bloc PARTIEL
//     (ex. `es: { searchAria, searchPh }`) est truthy : le fallback ne joue
//     plus et tout le reste du panneau devient `undefined`. Ajouter une langue
//     = la traduire entièrement, jamais à moitié.

import { describe, it, expect } from 'vitest'
import { COMMUNITY_I18N } from '@shared/lib/i18n/community-i18n'

const REFERENCE = 'fr'

describe('COMMUNITY_I18N — parité des clés', () => {
  it('le français sert de référence et n’est pas vide', () => {
    expect(Object.keys(COMMUNITY_I18N[REFERENCE]).length).toBeGreaterThan(0)
  })

  it.each(Object.keys(COMMUNITY_I18N).filter(l => l !== REFERENCE))(
    'la langue « %s » déclare exactement les mêmes clés que le français',
    (lang) => {
      const expected = Object.keys(COMMUNITY_I18N[REFERENCE]).sort()
      const actual = Object.keys(COMMUNITY_I18N[lang]).sort()
      expect(actual).toEqual(expected)
    },
  )

  // La parité seule ne suffit pas : une clé renommée dans TOUS les blocs reste
  // « à parité » alors que le composant qui la consomme rend `undefined`. Les
  // tests de DetailView/ComposeModal passent un `t` mocké et ne le verraient pas.
  it('les clés de libellés consommées par les composants existent', () => {
    const consumed = [
      'searchAria', 'searchPh', 'themeLight', 'themeDark',
      'closeAria', 'removeRecipeAria', 'sendReplyAria',
    ]
    for (const key of consumed) {
      expect(COMMUNITY_I18N[REFERENCE][key], key).toBeTruthy()
    }
  })

  it('aucune valeur vide ou non définie', () => {
    for (const [lang, block] of Object.entries(COMMUNITY_I18N)) {
      for (const [key, value] of Object.entries(block)) {
        expect(value, `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
