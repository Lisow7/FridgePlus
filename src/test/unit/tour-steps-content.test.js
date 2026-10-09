// Le guide raconte l'histoire du menu : Le bouton orange → Remplir → Vérifier
// → Cuisiner → Aller plus loin. Ces tests verrouillent la STRUCTURE (les
// étapes, leurs icônes, la présence du ticket), pas la prose.
import { describe, it, expect } from 'vitest'
import { TOUR_STEPS_I18N } from '@features/onboarding/i18n/tour-steps-i18n'
import { TOUR_ICONS } from '@features/onboarding/lib/tour-icons'

const ICONES = new Set([...Object.keys(TOUR_ICONS), 'fab'])

describe('étapes du guide — structure', () => {
  for (const lang of ['fr', 'en']) {
    const d = TOUR_STEPS_I18N[lang]

    it(`${lang} : les quatre étapes communes existent, « voice » a fusionné dans Remplir`, () => {
      expect(d.fab).toBeDefined(); expect(d.fridge).toBeDefined(); expect(d.check).toBeDefined(); expect(d.recipes).toBeDefined()
      expect(d.voice).toBeUndefined()
    })

    it(`${lang} : Remplir propose les quatre façons du menu, dans son ordre, avec ses icônes`, () => {
      expect(d.fridge.options.map(o => o.icon)).toEqual(['door', 'search', 'mic', 'camera'])
    })

    it(`${lang} : Vérifier présente l'inventaire et les restes avec leurs icônes`, () => {
      expect(d.check.options.map(o => o.icon)).toEqual(['inventory', 'leftovers'])
    })

    it(`${lang} : toute icône référencée existe dans le registre`, () => {
      for (const etape of Object.values(d)) {
        for (const x of [...(etape.options ?? []), ...(etape.tips ?? [])]) {
          if (x.icon) expect(ICONES.has(x.icon), `icône inconnue « ${x.icon} »`).toBe(true)
          expect(Boolean(x.icon) || Boolean(x.i), 'une puce a une icône OU un emoji').toBe(true)
        }
      }
    })

    it(`${lang} : la finale invité s'intitule « Aller plus loin » et dit l'état exact du premium`, () => {
      expect(d.final_guest.title).toBe(lang === 'fr' ? 'Aller plus loin' : 'Going further')
      expect(d.final_guest.desc.toLowerCase()).toMatch(lang === 'fr' ? /gratuit/ : /free/)
    })
  }
})
