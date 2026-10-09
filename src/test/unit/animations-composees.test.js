import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Une animation qui tourne sans fin n'anime que ce que le compositeur sait
// animer seul (audit du 2026-10-04, PERF-09).
//
// Les halos des poignées et du bouton orange animaient `box-shadow` en continu :
// à chaque image (60 par seconde), le navigateur recalculait le style des cinq
// éléments et les repeignait sur le fil principal, sans jamais retomber au
// repos — et sous une fenêtre à flou d'arrière-plan, il refaisait le flou de
// tout l'écran. Même lueur désormais, posée fixe dans un pseudo-élément dont
// seule l'opacité s'anime.

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Le corps d'un bloc `@keyframes nom { … }` (accolades équilibrées).
function keyframes(nom) {
  const debut = CSS.search(new RegExp(`@keyframes\\s+${nom}\\s*\\{`))
  if (debut < 0) return null
  let i = CSS.indexOf('{', debut)
  let profondeur = 0
  const ouverture = i
  for (; i < CSS.length; i++) {
    if (CSS[i] === '{') profondeur++
    else if (CSS[i] === '}' && --profondeur === 0) break
  }
  return CSS.slice(ouverture + 1, i)
}

// Les noms des animations lancées « infinite ».
const INFINIES = [...new Set([...CSS.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)[^;]*infinite/g)].map((m) => m[1]))]

// Ce que le compositeur ne sait pas animer seul.
const PROPRIETES_CHERES = /\b(box-shadow|width|height|top|left|right|bottom|margin|padding|filter|background(?:-color)?)\s*:/

describe('animations sans fin', () => {
  it('le relevé trouve les halos (témoin)', () => {
    expect(INFINIES).toEqual(expect.arrayContaining(['fp-luit', 'fp-luit-bouton']))
  })

  for (const nom of ['fp-luit', 'fp-luit-bouton']) {
    it(`${nom} n'anime que l'opacité`, () => {
      const corps = keyframes(nom)
      expect(corps).toBeTruthy()
      expect(corps).toMatch(/opacity\s*:/)
      expect(corps).not.toMatch(PROPRIETES_CHERES)
    })
  }

  it('aucune animation sans fin n’anime une propriété chère', () => {
    const fautives = INFINIES.filter((nom) => PROPRIETES_CHERES.test(keyframes(nom) ?? ''))
    expect(fautives).toEqual([])
  })

  it('les halos sont dans un pseudo-élément, pas sur l’élément lui-même', () => {
    expect(CSS).toMatch(/\.fp-poignee::after/)
    expect(CSS).toMatch(/\.fp-luit-bouton::after/)
    expect(CSS).not.toMatch(/\.fp-poignee\s*\{[^}]*animation/)
  })

  it('sous une fenêtre modale, la lueur s’arrête', () => {
    expect(CSS).toMatch(/:has\(\[aria-modal="true"\]\)[^{]*\.fp-poignee::after[^{]*\{[^}]*animation-play-state:\s*paused/)
  })
})
