import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLesErreursJetees } from '../../../scripts/erreurs-jetees.mjs'

// Le nombre d'appels qui JETTENT l'erreur rendue par une fonction ne peut que
// baisser (audit du 2026-10-04, ARCH-05).
//
// 29 appels jetaient le `{ error }` de Supabase, et dans les cas relus l'écran
// disait une chose fausse : réaction affichée qui n'existait pas, signalement
// « envoyé » qui n'était pas parti. Le correctif était fait à un endroit et
// pas dans la fonction voisine du même fichier. Ce plafond, au cran exact comme
// celui du lint, empêche un nouvel oubli et oblige à le baisser à chaque
// correction. Les 8 restants (2026-10-08) : six du panier (Premium fermé,
// lot 15) et deux nettoyages de la double authentification (lot 2). Le
// vidage ignoré du chargement de liste est corrigé, et un faux positif (une
// affectation sur deux lignes) n'est plus compté.

const PLAFOND = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).erreursJeteesPlafond

describe('appels qui jettent leur erreur — plafond', () => {
  // 30 s et non les 5 s par défaut : le recensement analyse TOUT `src/`. Seul,
  // il prend une seconde ; sous la charge de la suite complète, il a dépassé
  // 5 s (5 096 ms le 2026-10-07) et échoué sans aucun écart de compte.
  it('le compte est EXACTEMENT au plafond (il ne monte pas, et chaque baisse se note)', () => {
    const { jetes } = recenserLesErreursJetees()
    const detail = jetes.map((j) => `  ${j.fichier}:${j.ligne}  ${j.code}`).join('\n')
    expect(jetes.length, jetes.length > PLAFOND
      ? `Un appel jette l'erreur qu'il reçoit — lire { error } et le dire :\n${detail}`
      : `Bravo : ${PLAFOND - jetes.length} appel(s) en moins. Baisser erreursJeteesPlafond à ${jetes.length} dans package.json.`,
    ).toBe(PLAFOND)
  }, 30_000)
})

describe('le détecteur compte ce qu’il doit (témoins)', () => {
  let racine
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'erreurs-jetees-'))
    mkdirSync(join(racine, 'api'))
    writeFileSync(join(racine, 'api', 'ecrire.js'), [
      'export async function ecrire(x) {',
      '  if (!x) return { error: "invalid" }',
      '  return { ok: true }',
      '}',
      'export async function logAuditAction(a) { return { error: null } }',
      '',
    ].join('\n'))
  })
  afterAll(() => { rmSync(racine, { recursive: true, force: true }) })

  const compter = (code) => {
    writeFileSync(join(racine, 'ecran.js'), code)
    return recenserLesErreursJetees({ racine }).jetes.length
  }

  it('compte un appel dont le résultat est jeté', () => {
    expect(compter('async function f() {\n  await ecrire(1)\n}\n')).toBe(1)
    expect(compter('function f() {\n  ecrire(1).catch(() => {})\n}\n')).toBe(1)
  })

  it('ne compte pas un résultat lu', () => {
    expect(compter('async function f() {\n  const { error } = await ecrire(1)\n  return error\n}\n')).toBe(0)
    expect(compter('async function f() {\n  return ecrire(1)\n}\n')).toBe(0)
  })

  it('ne compte pas un résultat affecté à la ligne d’avant (affectation sur deux lignes)', () => {
    // Faux positif vu le 2026-10-08 : `const { … } =` puis, à la ligne
    // suivante, `useCartActions({ … })`. Il comptait pour un oubli et a
    // masqué, au lot 14c, le retrait d'un vrai.
    expect(compter('function f() {\n  const { a, b } =\n    ecrire(1)\n  return a\n}\n')).toBe(0)
    expect(compter('function f() {\n  return Promise.all([\n    ecrire(1),\n  ])\n}\n')).toBe(0)
    // Un vrai oubli après une ligne qui se termine autrement reste compté.
    expect(compter('async function f() {\n  const x = 1\n  await ecrire(x)\n}\n')).toBe(1)
  })

  it('ne compte pas un `.then` qui reçoit le résultat à la ligne suivante', () => {
    expect(compter('function f() {\n  ecrire(1)\n    .then((resultat) => resultat)\n}\n')).toBe(0)
  })

  it('ne compte pas les journaux « au mieux »', () => {
    expect(compter('async function f() {\n  await logAuditAction("x")\n}\n')).toBe(0)
  })
})
