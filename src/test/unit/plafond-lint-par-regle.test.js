import { describe, it, expect } from 'vitest'
import { compterLeLint } from '../../../scripts/verifier-plafond-lint.mjs'

// Le cliquet du lint (`npm run lint`) tient deux sortes de plafonds, au cran
// exact, en UN passage d'ESLint :
//   - `lintWarningsPlafond` : tous les avertissements ordinaires ;
//   - `lintPlafondsParRegle` : une règle comptée à part — d'abord
//     `max-lines-per-function` (audit du 2026-10-04, ARCH-08 : les fonctions
//     de plus de 100 lignes). Mêlés au compte général, ses 158 avertissements
//     auraient noyé les 82 autres.

const message = (ruleId, severity = 1) => ({ ruleId, severity })
const RAPPORT = [
  { messages: [message('react-hooks/refs'), message('max-lines-per-function'), message('max-lines-per-function')] },
  { messages: [message('react-hooks/refs'), message('no-unused-vars', 2)] },
  { messages: [message(null)] },
]

describe('compterLeLint — un compte général, des règles à part', () => {
  it('une règle à part ne compte pas dans le général', () => {
    const { avertissements, separes } = compterLeLint(RAPPORT, { 'max-lines-per-function': 2 })
    expect(avertissements).toBe(3)
    expect(separes.get('max-lines-per-function')).toBe(2)
  })

  it('sans règle à part, tout est général (le comportement d’avant)', () => {
    expect(compterLeLint(RAPPORT).avertissements).toBe(5)
  })

  it('une règle à part sans aucun avertissement compte zéro, au lieu de disparaître', () => {
    expect(compterLeLint(RAPPORT, { 'complexity': 0 }).separes.get('complexity')).toBe(0)
  })

  it('les erreurs restent comptées, quelle que soit la règle', () => {
    expect(compterLeLint(RAPPORT, { 'no-unused-vars': 0 }).erreurs).toBe(1)
  })

  it('la répartition du général ne montre pas les règles à part', () => {
    const { parRegle } = compterLeLint(RAPPORT, { 'max-lines-per-function': 2 })
    expect([...parRegle.keys()].sort()).toEqual(['(sans règle)', 'react-hooks/refs'])
  })
})
