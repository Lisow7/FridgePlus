import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLegalSection } from '@features/legal/data/legal-content'

// Audit du 2026-10-04, RGPD-13 : trois règles d'âge. Le formulaire exigeait
// 16 ans ; les CGU et la FAQ disaient 16 ans, mais ouvraient le service aux
// 13-15 ans « avec l'autorisation d'un parent » — qu'aucun mécanisme ne
// recueille — en citant un « RGPD France » qui fixe ce seuil à 15 ans. Une
// seule règle : 16 ans, présentée pour ce qu'elle est, un choix de Fridge+.

const textes = (lang) => JSON.stringify([getLegalSection(lang, 'terms'), getLegalSection(lang, 'faq')])
const lire = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('une seule règle d’âge : 16 ans', () => {
  for (const lang of ['fr', 'en']) {
    it(`${lang} : CGU et FAQ disent 16 ans, sans exception pour les 13-15 ans`, () => {
      const t = textes(lang)
      expect(t).toMatch(/16 ans|16\b/)
      expect(t).not.toMatch(/13[-–]15|13 et 15|13 and 15/)
      expect(t).not.toMatch(/autorisation explicite|explicit authori[sz]ation/)
    })
  }

  it('le choix est présenté honnêtement : plus strict que la loi française (15 ans)', () => {
    expect(textes('fr')).toMatch(/choix de Fridge\+[^"]*15 ans/)
    expect(textes('en')).toMatch(/Fridge\+'s choice[^"]*15/)
  })

  it('le formulaire d’inscription, le choix du pseudo et la fiche Play disent la même chose', () => {
    for (const f of ['src/features/auth/pages/signup-page.jsx', 'src/features/auth/pages/choose-username-page.jsx']) {
      expect(lire(f), f).toMatch(/au moins 16 ans/)
    }
    expect(lire('docs/play-fiche-textes.md')).toMatch(/16 ans et plus/)
  })
})
