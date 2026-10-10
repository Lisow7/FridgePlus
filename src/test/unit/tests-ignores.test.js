import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Audit du 2026-10-04, ARCH-17 (1, 2, 3) — quinze tests ignorés (`describe.skip`,
// `it.skip`), dont un pied de page entier et quatre corps vides, et un e2e qui
// se sautait lui-même (`test.skip()` quand le bouton n'est pas visible : vert
// quoi qu'il arrive). Un test ignoré promet une vérification qui n'a pas lieu ;
// il se réécrit contre le code d'aujourd'hui ou disparaît. Ce garde-fou refuse
// qu'il en revienne.

const RACINE = resolve(process.cwd())

function fichiers(dossier) {
  const out = []
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name)
    if (e.isDirectory()) out.push(...fichiers(chemin))
    else if (/\.(test|spec)\.jsx?$/.test(e.name)) out.push(chemin)
  }
  return out
}

const IGNORE = /\b(describe|it|test)\.(skip|todo)\s*\(/

describe('aucun test ignoré', () => {
  it('le témoin voit `it.skip(`, `describe.skip(`, `test.skip()` et `it.todo(`', () => {
    for (const forme of ["it.skip('x', () => {})", "describe.skip('x', () => {})", 'test.skip()', "it.todo('x')"]) {
      expect(IGNORE.test(forme), forme).toBe(true)
    }
    expect(IGNORE.test("it('skip the onboarding', () => {})")).toBe(false)
    expect(IGNORE.test('await skipOnboardingOverlays(page)')).toBe(false)
  })

  it('ni dans src/test ni dans e2e', () => {
    const coupables = []
    for (const dossier of ['src/test', 'e2e']) {
      for (const f of fichiers(join(RACINE, dossier))) {
        if (f.endsWith('tests-ignores.test.js')) continue // ses propres témoins
        readFileSync(f, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
          if (IGNORE.test(ligne)) coupables.push(`${f.slice(RACINE.length + 1).replaceAll('\\', '/')}:${i + 1}`)
        })
      }
    }
    expect(coupables).toEqual([])
  })
})
