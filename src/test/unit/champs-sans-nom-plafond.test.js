import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLesChampsSansNom } from '../../../scripts/champs-sans-nom.mjs'

// Les champs de formulaire sans nom accessible ne peuvent que baisser (audit
// du 2026-10-04, A11Y-07 : 76 champs sur 131 — un lecteur d'écran annonçait
// « zone de texte » sans dire laquelle, ou lisait un `placeholder` qui
// disparaît à la saisie). Deux plafonds au cran exact, comme le lint :
// `champsSansNomPlafond` et `champsPlaceholderSeulPlafond` (package.json).
// Pour corriger : `node scripts/champs-sans-nom.mjs` liste les champs, et
// `@shared/ui/field` relie un libellé à son champ.

const PAQUET = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

describe('champs sans nom — plafonds', () => {
  const r = recenserLesChampsSansNom()
  const liste = (champs) => champs.map((c) => `  ${c.fichier}:${c.ligne}  <${c.nom}>`).join('\n')

  it('aucun fichier illisible (sinon ses champs échapperaient au compte)', () => {
    expect(r.illisibles).toEqual([])
  })

  it('champs SANS AUCUN nom : exactement au plafond', () => {
    expect(r.sansNom.length, r.sansNom.length > PAQUET.champsSansNomPlafond
      ? `Un champ n'a pas de nom — <Field label="…"> ou aria-label :\n${liste(r.sansNom)}`
      : `Bravo : ${PAQUET.champsSansNomPlafond - r.sansNom.length} en moins. Baisser champsSansNomPlafond à ${r.sansNom.length}.`,
    ).toBe(PAQUET.champsSansNomPlafond)
  })

  it('champs nommés par leur SEUL placeholder : exactement au plafond', () => {
    expect(r.placeholderSeul.length, r.placeholderSeul.length > PAQUET.champsPlaceholderSeulPlafond
      ? `Un placeholder disparaît à la saisie — donner un vrai nom :\n${liste(r.placeholderSeul)}`
      : `Bravo : ${PAQUET.champsPlaceholderSeulPlafond - r.placeholderSeul.length} en moins. Baisser champsPlaceholderSeulPlafond à ${r.placeholderSeul.length}.`,
    ).toBe(PAQUET.champsPlaceholderSeulPlafond)
  })

  // Décision du 2026-10-06 (« libellés = visibles ») : un nom entendu par
  // les lecteurs d'écran mais absent de l'écran, et un texte grisé qui
  // s'efface dès qu'on tape. Un libellé au-dessus, le texte grisé en exemple.
  it('champs dont le libellé ne se voit pas (aria-label seul + texte grisé) : exactement au plafond', () => {
    expect(r.libellesInvisibles.length, r.libellesInvisibles.length > PAQUET.champsLibelleInvisiblePlafond
      ? `Un champ n'a de nom que pour les lecteurs d'écran — un libellé visible (<Field label="…">) :\n${liste(r.libellesInvisibles)}`
      : `Bravo : ${PAQUET.champsLibelleInvisiblePlafond - r.libellesInvisibles.length} en moins. Baisser champsLibelleInvisiblePlafond à ${r.libellesInvisibles.length}.`,
    ).toBe(PAQUET.champsLibelleInvisiblePlafond)
  })
})

describe('le détecteur compte ce qu’il doit (témoins)', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'champs-sans-nom-'))
    writeFileSync(join(racine, 'temoins.jsx'), [
      'export function Temoins({ rest, id }) {',
      '  return (',
      '    <form>',
      '      <div><label>Voisin</label><select /></div>',                                  // 4 sans nom
      '      <label htmlFor="pseudo">Pseudo</label><input id="pseudo" />',                  // 5 nommé
      '      <label htmlFor={id}>Lié</label><input id={id} />',                             // 6 nommé
      '      <label>Englobant <input /></label>',                                           // 7 nommé
      '      <label>{true && <textarea />}</label>',                                        // 8 nommé
      '      <input aria-label="Rechercher" />',                                            // 9 nommé
      '      <input placeholder="Ton e-mail" />',                                           // 10 placeholder
      '      <input type="hidden" name="x" />',                                             // 11 ignoré
      '      <input type="submit" value="OK" />',                                           // 12 ignoré
      '      <input className="hidden" type="file" />',                                     // 13 ignoré
      '      <input style={{ display: \'none\' }} />',                                      // 14 ignoré
      '      <input {...rest} />',                                                          // 15 délégué
      '      <input id="orphelin" />',                                                      // 16 sans nom
      '      <input type="checkbox" />',                                                    // 17 sans nom
      '      <input title="Quantité" type="number" />',                                     // 18 nommé
      '      <Field label="Statut"><select /></Field>',                                     // 19 nommé
      '      <Field hint="sans libellé"><select /></Field>',                                // 20 sans nom
      '      <input aria-label="Rechercher" placeholder="Rechercher…" />',                // 21 libellé invisible
      '      <input aria-labelledby="titre" placeholder="ex. : tomate" />',               // 22 nommé
      '      <input type="checkbox" title="Choisir" placeholder="x" />',               // 23 nommé (sans texte)
      '    </form>',
      '  )',
      '}',
    ].join('\n'))
    r = recenserLesChampsSansNom({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('sans nom : le libellé voisin non relié, l’id que rien ne cible, la case à cocher nue, un Field sans libellé', () => {
    expect(r.sansNom.map((c) => c.ligne)).toEqual([4, 16, 17, 20])
  })

  it('placeholder seul : compté à part', () => {
    expect(r.placeholderSeul.map((c) => c.ligne)).toEqual([10])
  })

  it('délégué (props étalées) : ni sans nom, ni nommé', () => {
    expect(r.delegues.map((c) => c.ligne)).toEqual([15])
  })

  it('libellé invisible : un aria-label et un texte grisé — pas un aria-labelledby, pas une case à cocher', () => {
    expect(r.libellesInvisibles.map((c) => c.ligne)).toEqual([21])
  })

  it('ignorés : types sans saisie et champs cachés ; total = nommés + sans nom + placeholder + délégués + invisibles', () => {
    // 4 à 10, 15 à 23 → 16 champs comptés (11 à 14 ignorés).
    expect(r.total).toBe(16)
  })
})
