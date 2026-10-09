import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLesCouleursEnDur } from '../../../scripts/couleurs-en-dur.mjs'

// Les couleurs écrites en dur dans les composants ne peuvent que baisser
// (audit du 2026-10-04, UX-13 : 2 503 hexadécimaux dans src/, des jetons
// recopiés à la main — `#FDFAF6` pour `--color-surface`, `#D46A10` pour
// `--color-brand-600`). Plafond au cran exact, comme le lint :
// `couleursEnDurPlafond` (package.json). Pour corriger : remplacer la couleur
// par son jeton (`var(--color-…)`), puis baisser le plafond.

const PAQUET = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

describe('couleurs en dur dans les composants — plafond', () => {
  const r = recenserLesCouleursEnDur()

  it('aucun fichier illisible (sinon ses couleurs échapperaient au compte)', () => {
    expect(r.illisibles).toEqual([])
  })

  it('exactement au plafond', () => {
    const tete = r.parFichier.slice(0, 5).map((f) => `  ${f.n}  ${f.fichier}`).join('\n')
    expect(r.total, r.total > PAQUET.couleursEnDurPlafond
      ? `Une couleur a été écrite en dur : utiliser son jeton (var(--color-…)). Les plus chargés :\n${tete}`
      : `Bravo : ${PAQUET.couleursEnDurPlafond - r.total} en moins. Baisser couleursEnDurPlafond à ${r.total}.`,
    ).toBe(PAQUET.couleursEnDurPlafond)
  })
})

describe('le détecteur compte ce qu’il doit (témoins)', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'couleurs-en-dur-'))
    mkdirSync(join(racine, 'src/test'), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      '// #FFFFFF dans un commentaire ne compte pas',
      "export const A = () => <div style={{ color: '#FDFAF6' }} className=\"bg-[#B85000] text-[#fff]\">#texte</div>", // 3
      'export const G = `linear-gradient(#F7A85E, #D46A10cc)`',                                                        // 2
      "export const N = 'PR #12345, lot #1234567, var(--color-surface)'",                                              // 0
    ].join('\n'))
    writeFileSync(join(racine, 'src/jetons.js'), "export const NOIR = '#000'\n")          // un .js : hors compte
    writeFileSync(join(racine, 'src/b.test.jsx'), "export const T = '#000'\n")            // un test : hors compte
    writeFileSync(join(racine, 'src/test/c.jsx'), "export const T = '#000'\n")            // dossier de tests : hors compte
    r = recenserLesCouleursEnDur({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('compte les couleurs des textes des .jsx, et seulement elles', () => {
    expect(r.illisibles).toEqual([])
    expect(r.parFichier).toEqual([{ fichier: 'src/temoins.jsx', n: 5 }])
    expect(r.total).toBe(5)
  })
})
