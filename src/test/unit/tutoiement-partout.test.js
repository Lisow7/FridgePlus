import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLeVouvoiement } from '../../../scripts/vouvoiement.mjs'

// Tutoiement partout, sauf les pages légales et le panneau admin (audit du
// 2026-10-04, UX-16). La règle tenait à 364 chaînes contre 3, et le reste
// était du résidu : « Appuyez sur ♡ » sur l'écran des favoris vides, « Recevez
// un rappel », la page 404 statique, les données structurées de l'accueil.
// Le détecteur (`scripts/vouvoiement.mjs`) lit les TEXTES du code — pas les
// commentaires ni les expressions régulières — et le HTML servi tel quel.

describe('tutoiement partout', () => {
  const r = recenserLeVouvoiement()

  it('aucun fichier illisible (sinon ses textes échapperaient au relevé)', () => {
    expect(r.illisibles).toEqual([])
  })

  it('aucun vouvoiement hors pages légales et admin', () => {
    const liste = r.releves.map((v) => `  ${v.fichier}:${v.ligne}  « ${v.mot} »`).join('\n')
    expect(r.releves, `L'app tutoie (« Appuie », « ton frigo ») :\n${liste}`).toEqual([])
  })
})

describe('le détecteur relève ce qu’il doit (témoins)', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'vouvoiement-'))
    mkdirSync(join(racine, 'src/features/legal'), { recursive: true })
    mkdirSync(join(racine, 'src/shared/lib/recipes'), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      '// votre commentaire ne compte pas',                                   // 1
      'const PRONOMS = /^(?:tu\\s+|vous\\s+)/i',                              // 2 expression régulière
      'export const A = ({ n }) => <p>Appuyez ici</p>',                       // 3 relevé
      'export const B = (n) => `Recevez ${n} rappels`',                       // 4 relevé
      "export const C = 'Merguez de chez le boucher, assez grillées'",        // 5 mots permis
      "export const D = 'Tap ♡ on any recipe'",                                // 6 anglais
    ].join('\n'))
    writeFileSync(join(racine, 'src/features/legal/mentions.jsx'), "export const L = 'Vous pouvez nous écrire'\n")
    writeFileSync(join(racine, 'src/shared/lib/recipes/culinary-glossary.js'), [
      "export const G = [",                                                   // 1
      "  { def: { fr: 'Couper fin' }, match: { fr: ['hacher', 'hachez'] } },", // 2 mot à reconnaître
      "  { def: { fr: 'Hachez finement' } },",                                 // 3 relevé : affiché
      ']',
    ].join('\n'))
    writeFileSync(join(racine, 'index.html'), '<!-- votre commentaire -->\n<p>Inventaire de votre frigo</p>\n')
    r = recenserLeVouvoiement({ racine, pages: ['index.html'] })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('relève les textes, et seulement eux', () => {
    expect(r.illisibles).toEqual([])
    expect(r.releves).toEqual([
      { fichier: 'src/shared/lib/recipes/culinary-glossary.js', ligne: 3, mot: 'Hachez' },
      { fichier: 'src/temoins.jsx', ligne: 3, mot: 'Appuyez' },
      { fichier: 'src/temoins.jsx', ligne: 4, mot: 'Recevez' },
      { fichier: 'index.html', ligne: 2, mot: 'votre' },
    ])
  })
})
