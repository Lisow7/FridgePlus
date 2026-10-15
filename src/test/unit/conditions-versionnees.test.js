import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { LEGAL_CONTENT, getLegalSection } from '@features/legal/data/legal-content'
import { VERSION_DES_CGU } from '@features/legal/data/version-des-conditions'
import { corpsLegal } from '@prerender/corps-statique'

// Décision du 2026-10-08 : annoncer chaque changement des conditions d’utilisation
// 30 jours avant, comme elles le promettent — une procédure écrite, une annonce
// dans l’app, la date de version au bas des conditions.
//
// 🔴 Ce garde-fou rend la procédure exécutable : le texte des CGU (français et
// anglais) a une empreinte, inscrite à côté de sa date de version. Le texte change
// sans nouvelle date ? Le test rougit et dit quoi faire.

const PROCEDURE = 'docs/procedure-changement-des-cgu.md'
const empreinte = () => createHash('sha256')
  .update(JSON.stringify([LEGAL_CONTENT.fr.terms, LEGAL_CONTENT.en.terms]))
  .digest('hex').slice(0, 16)

describe('les conditions d’utilisation sont versionnées', () => {
  it('le texte n’a pas changé depuis sa date de version', () => {
    expect(
      empreinte(),
      `Les CGU ont changé : nouvelle date de version et nouvelle empreinte dans `
      + `version-des-conditions.js, puis, pour un changement de fond, l’annonce dans `
      + `l’app 30 jours avant son entrée en vigueur — voir ${PROCEDURE}.`,
    ).toBe(VERSION_DES_CGU.empreinte)
  })

  it('la date de version est une vraie date, pas dans le futur', () => {
    expect(VERSION_DES_CGU.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(VERSION_DES_CGU.date))).toBe(false)
  })

  it('elle est écrite au bas des conditions, dans les deux langues', () => {
    const fr = getLegalSection('fr', 'terms').blocks.at(-1)
    const en = getLegalSection('en', 'terms').blocks.at(-1)
    expect(fr).toEqual({ type: 'note', text: 'Version du 10 octobre 2026.', version: true })
    expect(en).toEqual({ type: 'note', text: 'Version of 10 October 2026.', version: true })
  })

  it('le HTML servi de /legal la porte aussi', () => {
    expect(corpsLegal('fr')).toContain('Version du 10 octobre 2026.')
  })

  it('la procédure existe et dit les 30 jours', () => {
    expect(existsSync(PROCEDURE)).toBe(true)
    expect(readFileSync(PROCEDURE, 'utf8')).toMatch(/30 jours/)
  })
})
