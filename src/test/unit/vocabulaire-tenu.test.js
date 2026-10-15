import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { recenserLeVocabulaire } from '../../../scripts/vocabulaire.mjs'
import { LEFTOVERS_I18N } from '@features/fridge/i18n/leftovers-i18n'

// Un nom par chose (audit du 2026-10-04, UX-08 et UX-16 ; décision du 2026-10-08 tranchée
// par Antoine le 2026-10-08). Dix notions portaient plusieurs noms, parfois
// dans la même phrase : on « vidait le panier » mais on « sauvegardait la
// liste » dans la même fenêtre, l'aide envoyait dans « le bouton d'actions »
// un menu nommé « Actions rapides ». La référence est `docs/vocabulaire.md` ;
// le détecteur (`scripts/vocabulaire.mjs`) relève les synonymes écartés dans
// ce que l'app AFFICHE, langue par langue.

describe('un nom par chose', () => {
  const r = recenserLeVocabulaire()

  it('aucun fichier illisible (sinon ses textes échapperaient au relevé)', () => {
    expect(r.illisibles).toEqual([])
  })

  it('aucun synonyme écarté dans ce que l’app affiche', () => {
    const liste = r.releves.map((v) => `  ${v.fichier}:${v.ligne}  [${v.lang ?? '?'}] « ${v.mot} » → ${v.canon}`).join('\n')
    expect(r.releves, `Les noms de docs/vocabulaire.md :\n${liste}`).toEqual([])
  })

  // « Mes recettes » = seulement celles qu'on a créées : un reste vient des
  // recettes en général.
  it('un reste vient de « Recettes », pas de « Mes recettes »', () => {
    expect(LEFTOVERS_I18N.fr.fromRecipes).toBe('Recettes')
    expect(LEFTOVERS_I18N.en.fromRecipes).toBe('Recipes')
  })
})

describe('le détecteur relève ce qu’il doit (témoins)', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'vocabulaire-'))
    mkdirSync(join(racine, 'src/features/admin'), { recursive: true })
    mkdirSync(join(racine, 'src/features/changelog/data'), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      "import { x } from '@features/cart/api/basket'",                              // 1 chemin de module
      "export const A = { fr: { titre: 'Ta liste de courses' }, en: { titre: 'Your basket' } }", // 2 deux relevés
      "export const B = (lang) => lang === 'fr' ? 'Nouveau post' : 'New post'",      // 3 relevé fr seulement
      "export const C = (fr) => fr ? 'Supprimer ce post ?' : 'Delete this post?'",    // 4 relevé fr seulement
      "export const D = { table: 'user_basket', cle: 'basket' }",                     // 5 identifiants
      "export const E = () => console.error('[basket] échec')",                       // 6 journal
      "export const F = { fr: 'Le bouton orange, Actions rapides', en: 'The orange button' }", // 7 relevé en
      "export const G = <p data-testid=\"Basket row\" className=\"basket-row\">Mon panier</p>", // 8 attributs techniques
      "export const H = 'Pas encore de post'",                                        // 9 langue inconnue : règle non sûre
      "export const I = 'Cuisine guidée'",                                            // 10 langue inconnue : règle sûre
      "export const J = { fr: 'J’aime', en: 'Log in to continue' }",                  // 11 relevé en
    ].join('\n'))
    writeFileSync(join(racine, 'src/features/admin/panneau.jsx'), "export const P = { fr: 'Posts signalés' }\n")
    writeFileSync(join(racine, 'src/features/changelog/data/journal.js'), "export const V = { fr: 'Bouton d’actions refait' }\n")
    r = recenserLeVocabulaire({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('relève les textes affichés, dans leur langue, et seulement eux', () => {
    expect(r.illisibles).toEqual([])
    expect(r.releves.map((v) => `${v.ligne} ${v.lang ?? '?'} ${v.mot}`)).toEqual([
      '2 fr liste de courses',
      '2 en basket',
      '3 fr post',
      '4 fr post',
      '7 en orange button',
      '10 ? Cuisine guidée',
      '11 en Log in',
    ])
  })
})

describe('« Enregistrer » et un verbe par geste de retrait (décision du 2026-10-08) — témoins', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'verbes-'))
    mkdirSync(join(racine, 'src'), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      "export const A = { fr: { t: 'Sauvegarder ma liste' }, en: { t: 'Save my list' } }",         // 1 le verbe
      "export const B = { fr: 'Sauvegardes chiffrées : 30 jours' }",                              // 2 le nom (copies de secours) : permis
      "export const C = { fr: 'Supprimer l’étape', en: 'Delete step' }",                           // 3 retirer d'une liste
      "export const D = { fr: 'Vider le panier', en: 'Clear the cart' }",                          // 4 EN : Empty
      "export const E = { fr: 'Effacer la recherche', en: 'Clear search' }",                       // 5 un texte : permis
      "export const F = { fr: 'Effacer les notifications lues', en: 'Clear read notifications' }", // 6 pour de bon
      "export const G = { fr: 'Vider la recherche' }",                                             // 7 un texte s'efface
      "export const H = { fr: 'Effacer le frigo' }",                                               // 8 tout d'un coup se vide
      "export const I = { fr: 'Tu pourras le sauvegarder ici', en: 'Saved' }",                     // 9 le verbe, en phrase
      "export const J = { fr: 'Retirer du frigo', en: 'Remove from fridge' }",                     // 10 juste
    ].join('\n'))
    r = recenserLeVocabulaire({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('écarte le verbe « sauvegarder » mais pas les « sauvegardes », et chaque verbe hors de son geste', () => {
    expect(r.illisibles).toEqual([])
    expect(r.releves.map((v) => `${v.ligne} ${v.lang ?? '?'} ${v.mot}`)).toEqual([
      '1 fr Sauvegarder',
      '3 fr Supprimer l’étape',
      '3 en Delete step',
      '4 en Clear the cart',
      '6 fr Effacer les notifications',
      '6 en Clear read notifications',
      '7 fr Vider la recherche',
      '8 fr Effacer le frigo',
      '9 fr sauvegarder',
    ])
  })
})

describe('les apostrophes typographiques (décision du 2026-10-08) — témoins', () => {
  let racine
  let r
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'apostrophes-'))
    for (const d of ['src/shared/static', 'src/features/cooking-mode/lib']) mkdirSync(join(racine, d), { recursive: true })
    writeFileSync(join(racine, 'src/temoins.jsx'), [
      "export const A = { fr: 'Tu n\\'as rien', en: \"You don't\" }",        // 1 deux relevés
      "export const B = { fr: 'l’app est là', en: 'you’re here' }",                      // 2 déjà typographiques
      "export const C = '@keyframes x { from{opacity:0} to{opacity:1} } /* l\\'effet */'", // 3 un bloc CSS
      "export const D = { fr: \"Prix à l'unité\" }",                                  // 4 relevé
      "export const E = { en: \"The users' data\" }",                                    // 5 pas entre deux lettres
    ].join('\n'))
    writeFileSync(join(racine, 'src/shared/static/recipes.js'), "export const R = { fr: 'Bœuf à l\\'ancienne' }\n")
    writeFileSync(join(racine, 'src/features/cooking-mode/lib/intents.js'), "export const I = { fr: ['j\\'ai fini'] }\n")
    r = recenserLeVocabulaire({ racine })
  })
  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('relève l’apostrophe droite entre deux lettres, hors données, voix et CSS', () => {
    expect(r.illisibles).toEqual([])
    expect(r.releves.map((v) => `${v.fichier.split('/').pop()}:${v.ligne} ${v.lang ?? '?'}`)).toEqual([
      'temoins.jsx:1 fr',
      'temoins.jsx:1 en',
      'temoins.jsx:4 fr',
    ])
  })
})
