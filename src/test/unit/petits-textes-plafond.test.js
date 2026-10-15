import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLesPetitsTextes } from '../../../scripts/petits-textes.mjs'
import { TEXTE_MIN_PX } from '@shared/lib/taille-de-texte'

// Décision du 2026-10-08 (audit du 2026-10-04, A11Y) : 12 px minimum pour les
// textes, hors panneau admin — un réglage commun (`TEXTE_MIN_PX`) et un cliquet
// au cran exact, comme pour les couleurs : aucun nouveau texte plus petit, et
// chaque texte remonté au plancher fait baisser `petitsTextesPlafond`.
const PAQUET = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

describe('textes sous le plancher de 12 px — plafond', () => {
  const r = recenserLesPetitsTextes()

  it('le plancher est de 12 px', () => {
    expect(TEXTE_MIN_PX).toBe(12)
  })

  it('aucun fichier illisible (sinon ses petits textes échapperaient au compte)', () => {
    expect(r.illisibles).toEqual([])
  })

  it('exactement au plafond', () => {
    const tete = r.parFichier.slice(0, 5).map((f) => `  ${f.n}  ${f.fichier}`).join('\n')
    expect(r.total, r.total > PAQUET.petitsTextesPlafond
      ? `Un texte de moins de ${TEXTE_MIN_PX} px a été écrit : utiliser TEXTE_MIN_PX ou plus. Les plus chargés :\n${tete}`
      : `Bravo : ${PAQUET.petitsTextesPlafond - r.total} en moins. Baisser petitsTextesPlafond à ${r.total}.`,
    ).toBe(PAQUET.petitsTextesPlafond)
  }, 30_000)
})

describe('le détecteur compte ce qu’il doit (témoins)', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'petits-textes-'))
    mkdirSync(join(racine, 'src/features/admin'), { recursive: true })
    mkdirSync(join(racine, 'src/test'), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      "export const A = () => <p style={{ fontSize: '11px' }} className=\"text-[10px] text-[12px]\">texte</p>", // 2
      'export const B = { fontSize: 11, lineHeight: 1.4 }',                                                     // 1
      'export const C = { fontSize: grand ? 13 : 9.5, padding: 4 }',                                             // 1
      "export const D = { fontSize: '12px', padding: '8px' }",                                                   // 0
      "// fontSize: '10px' dans un commentaire : ne compte pas",                                                 // 0
    ].join('\n'))
    writeFileSync(join(racine, 'src/features/admin/panneau.jsx'), "export const P = { fontSize: '10px' }\n") // admin : hors compte
    writeFileSync(join(racine, 'src/styles.js'), "export const S = { fontSize: '10px' }\n")                   // un .js : hors compte
    writeFileSync(join(racine, 'src/b.test.jsx'), "export const T = { fontSize: 9 }\n")                       // un test : hors compte
    writeFileSync(join(racine, 'src/test/c.jsx'), "export const T = { fontSize: 9 }\n")                       // dossier de tests : hors compte
    r = recenserLesPetitsTextes({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('compte les tailles sous le plancher des .jsx hors admin, et seulement elles', () => {
    expect(r.illisibles).toEqual([])
    expect(r.parFichier).toEqual([{ fichier: 'src/temoins.jsx', n: 4 }])
    expect(r.total).toBe(4)
  })
})
