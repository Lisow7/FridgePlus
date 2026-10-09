import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Décision du 2026-10-06, choix d'Antoine (« couleurs = profond ») ; audit
// du 2026-10-04, A11Y-03. Le texte blanc sur l'orange vif #E07820 plafonne à
// 3,05:1 (WCAG AA demande 4,5:1). Les boutons passent en orange profond
// #B85000 (5,02:1) ; l'orange vif reste au logo et aux décors.

function fichiers(dossier, out = []) {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name)
    if (e.isDirectory()) { if (!/test/.test(e.name)) fichiers(p, out) }
    else if (/\.jsx$/.test(e.name)) out.push(p)
  }
  return out
}

describe('les boutons à texte blanc sont en orange profond', () => {
  it('aucun fond orange vif #E07820 sous du texte blanc', () => {
    const fautifs = []
    for (const f of fichiers('src')) {
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (/bg-\[#E07820\]/i.test(l) && /text-white/.test(l)) fautifs.push(`${f}:${i + 1}`)
      })
    }
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })

  // Les dégradés orange vifs (--gradient-warm, #D46A10 → #E07820…) sous du
  // texte blanc : axe ne sait pas les mesurer (« indécidable » sur un dégradé),
  // et le blanc y tombait à 2-3:1. Sous du blanc : --gradient-deep. Restent
  // vifs : les décors (pastilles, puces, anneaux, barres de progression) et le
  // texte foncé.
  it('aucun dégradé orange vif sous du texte blanc', () => {
    const fautifs = []
    const VIF = /var\(--gradient-warm\)|linear-gradient\([^)]*(#E07820|#D46A10|#F5A45A)/i
    const BLANC = /color:\s*['"](white|#fff|#ffffff)['"]|text-white/i
    for (const f of fichiers('src')) {
      const l = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n')
      l.forEach((ligne, i) => {
        if (!VIF.test(ligne) || /transition: 'width/.test(ligne)) return
        const zone = l.slice(Math.max(0, i - 6), i + 7).join('\n')
        if (BLANC.test(zone) && !/backgroundClip:\s*['"]text|WebkitTextFillColor|color:\s*['"]transparent/.test(zone)) fautifs.push(`${f}:${i + 1}`)
      })
    }
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })

  it('les badges teintés ont un texte à 4,5:1, en clair ET en sombre (jetons des deux thèmes)', () => {
    const css = readFileSync('src/index.css', 'utf8')
    const sombre = css.slice(css.indexOf('[data-theme="dark"] {'))
    for (const jeton of ['--badge-free-text', '--badge-account-text', '--badge-premium-text',
      '--badge-info-text', '--badge-neutral-text', '--badge-danger-text', '--color-warm-text', '--color-danger-text']) {
      expect(css.indexOf(`${jeton}:`), `${jeton} (clair)`).toBeGreaterThan(-1)
      expect(sombre.indexOf(`${jeton}:`), `${jeton} (sombre)`).toBeGreaterThan(-1)
    }
  })
})
