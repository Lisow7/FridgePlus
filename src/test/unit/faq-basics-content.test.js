// La FAQ « prise en main » répond aux confusions observées (captures du
// mainteneur, 11/09) et renvoie chaque réponse à l'étape du guide. Ces tests
// verrouillent la STRUCTURE et les garanties de fond, pas la prose.
import { describe, it, expect } from 'vitest'
import { FAQ_BASICS_I18N, getFaqBasics, getFaqBasicsMeta } from '@shared/lib/i18n/faq-basics-i18n'

const GROUPES = ['fill', 'check', 'cook', 'account']

describe('FAQ prise en main — structure', () => {
  for (const lang of ['fr', 'en']) {
    const qs = getFaqBasics(lang)
    const meta = getFaqBasicsMeta(lang)

    it(`${lang} : douze questions au plus, chacune rangée dans un bloc et renvoyée à une étape du guide`, () => {
      expect(qs.length).toBeGreaterThanOrEqual(8)
      expect(qs.length).toBeLessThanOrEqual(12)
      for (const x of qs) {
        expect(GROUPES).toContain(x.group)
        expect(x.step).toBeGreaterThanOrEqual(1); expect(x.step).toBeLessThanOrEqual(5)
        expect(x.q.trim().endsWith('?')).toBe(true)
        expect(x.a.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2)
      }
      for (const g of GROUPES) expect(meta.groups[g]).toBeTruthy()
      expect(meta.intro).toBeTruthy()
    })

    it(`${lang} : les blocs se lisent dans l'ordre du menu — Remplir, Vérifier, Cuisiner, puis le compte`, () => {
      const ordre = [...new Set(qs.map(x => x.group))]
      expect(ordre).toEqual(GROUPES)
    })

    it(`${lang} : la photo du ticket et le bouton orange sont nommés dans le bloc Remplir`, () => {
      const remplir = qs.filter(x => x.group === 'fill').map(x => (x.q + ' ' + x.a).toLowerCase()).join(' ')
      expect(remplir).toMatch(lang === 'fr' ? /ticket/ : /receipt/)
      expect(remplir).toMatch(lang === 'fr' ? /bouton orange/ : /orange button/)
    })

    it(`${lang} : la réponse premium dit que tout est gratuit`, () => {
      const premium = qs.find(x => /premium/i.test(x.q))
      expect(premium.a.toLowerCase()).toMatch(lang === 'fr' ? /tout est gratuit/ : /everything is free/)
    })
  }

  it('fr et en ont le même nombre de questions, dans le même ordre de blocs et d’étapes', () => {
    const fr = FAQ_BASICS_I18N.fr.questions, en = FAQ_BASICS_I18N.en.questions
    expect(en.map(x => [x.group, x.step])).toEqual(fr.map(x => [x.group, x.step]))
  })
})
