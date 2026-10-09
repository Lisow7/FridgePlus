import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  jsonLdRecette,
  contenuRecette,
  serialiserContenu,
  baliseJsonLd,
} from '../../../scripts/lib/prerender-page.mjs'
import { ligneIngredient } from '@shared/lib/recipes/recipe-ingredients'

// Le HTML servi d'une fiche porte ses ingrédients et ses étapes (audit du
// 2026-10-04, SEO-06).
//
// Le balisage Recipe servi ne portait que les champs courts : nom, image,
// description, durées. Les ingrédients et les étapes n'arrivaient qu'avec le
// JavaScript — que les robots d'IA (GPTBot, ClaudeBot, PerplexityBot)
// n'exécutent pas, et que Google ne lit qu'en seconde vague. La décision
// « ~500 Ko versionnés » restait ouverte : mesuré en base le 2026-10-05, le
// français seul pèse ~210 Ko (51 Ko d'ingrédients, 160 Ko d'étapes), dans un
// fichier À PART, une ligne par recette — changer une recette change une ligne.

const NOMS = new Map([
  ['gp-spaghetti', { labels: { fr: 'Spaghetti' } }],
  ['fr-oeufs-standard', { labels: { fr: 'Œufs' } }],
])

const LIGNE = {
  id: 'carbonara',
  ingredients: [
    { ids: ['gp-spaghetti'], qty: { unit: 'g', amount: 200 }, labels: { fr: '200g de spaghetti' }, required: true },
    { ids: ['fr-oeufs-standard'], qty: { unit: 'pcs', amount: 3 }, labels: { fr: '3 œufs' }, required: true },
  ],
  steps: { fr: ['Cuire les pâtes.', '', 'Mélanger hors du feu.'], en: ['Cook.', 'Mix.'] },
}

const BASE = { id: 'carbonara', nom: 'Pasta Carbonara', image: 'https://exemple/carbonara.webp' }

describe('le contenu d’une fiche, lu en base par le générateur', () => {
  it('écrit les ingrédients avec la règle du balisage client, et les étapes françaises non vides', () => {
    const contenu = contenuRecette(LIGNE, NOMS)
    expect(contenu.ingredients).toEqual(['200 g de Spaghetti', '3 Œufs'])
    expect(contenu.ingredients).toEqual(LIGNE.ingredients.map((i) => ligneIngredient(i, NOMS, 'fr')))
    expect(contenu.etapes).toEqual(['Cuire les pâtes.', 'Mélanger hors du feu.'])
  })

  it('lit aussi les ingrédients rangés en groupes et les étapes en objets { text }', () => {
    const groupes = {
      id: 'tarte',
      ingredients: { groups: [{ name: { fr: 'Pâte' }, items: [{ id: 'gp-spaghetti', amount: 100, unit: 'g' }] }] },
      steps: [{ id: 1, text: 'Étaler.' }, { id: 2, text: 'Cuire.' }],
    }
    expect(contenuRecette(groupes, NOMS)).toEqual({ ingredients: ['100 g de Spaghetti'], etapes: ['Étaler.', 'Cuire.'] })
  })

  it('rien en base : des listes vides, jamais une erreur', () => {
    expect(contenuRecette({ id: 'vide', ingredients: null, steps: null }, NOMS)).toEqual({ ingredients: [], etapes: [] })
  })
})

describe('le balisage servi', () => {
  it('porte les ingrédients et les étapes (HowToStep), dans l’ordre', () => {
    const b = jsonLdRecette({ ...BASE, ingredients: ['200 g de Spaghetti', '3 Œufs'], etapes: ['Cuire.', 'Mélanger.'] })
    expect(b.recipeIngredient).toEqual(['200 g de Spaghetti', '3 Œufs'])
    expect(b.recipeInstructions).toEqual([
      { '@type': 'HowToStep', text: 'Cuire.' },
      { '@type': 'HowToStep', text: 'Mélanger.' },
    ])
  })

  it('n’écrit pas de liste vide : une clé absente est honnête, une liste vide décrit faux', () => {
    const sans = jsonLdRecette({ ...BASE, ingredients: [], etapes: [] })
    expect(sans).not.toHaveProperty('recipeIngredient')
    expect(sans).not.toHaveProperty('recipeInstructions')
    const avant = jsonLdRecette(BASE)
    expect(avant).not.toHaveProperty('recipeIngredient')
    expect(avant).not.toHaveProperty('recipeInstructions')
  })

  it('une étape qui contient « </script> » ne ferme pas la balise', () => {
    const b = jsonLdRecette({ ...BASE, etapes: ['Servir </script><script>alert(1)</script> chaud.'] })
    const html = baliseJsonLd('recipe-jsonld', b)
    expect(html.match(/<\/script>/gi)).toHaveLength(1)
    expect(JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')).recipeInstructions[0].text)
      .toBe('Servir </script><script>alert(1)</script> chaud.')
  })
})

describe('le fichier versionné : une ligne par recette', () => {
  it('se relit à l’identique, et chaque recette tient sur UNE ligne', () => {
    const recettes = [
      { id: 'affogato', ingredients: ['2 Glace vanille'], etapes: ['Verser.'] },
      { id: 'carbonara', ingredients: ['200 g de Spaghetti'], etapes: ['Cuire.', 'Mélanger.'] },
    ]
    const texte = serialiserContenu({ lang: 'fr', genereLe: '2026-10-05', recettes })
    const relu = JSON.parse(texte)
    expect(relu.lang).toBe('fr')
    expect(relu.recettes.carbonara).toEqual({ ingredients: ['200 g de Spaghetti'], etapes: ['Cuire.', 'Mélanger.'] })
    for (const r of recettes) expect(lireLaLigne(texte, r.id)).toEqual({ ingredients: r.ingredients, etapes: r.etapes })
  })
})

// La recette ENTIÈRE tient sur la ligne de sa clé : relue seule, elle redonne
// tout son contenu.
function lireLaLigne(texte, id) {
  const lignes = texte.split('\n').filter((l) => l.startsWith(`    ${JSON.stringify(id)}: `))
  expect(lignes).toHaveLength(1)
  return JSON.parse(lignes[0].slice(`    ${JSON.stringify(id)}: `.length).replace(/,$/, ''))
}

describe('scripts/data/prerender-contenu.json (commité)', () => {
  const contenu = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/data/prerender-contenu.json'), 'utf8'))
  const manifeste = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/data/prerender-manifest.json'), 'utf8'))
  const ids = Object.keys(contenu.recettes)

  it('couvre exactement les recettes du manifeste', () => {
    expect([...ids].sort()).toEqual(manifeste.recettes.map((r) => r.id).sort())
  })

  it('en français, et presque toutes ont ingrédients ET étapes', () => {
    expect(contenu.lang).toBe('fr')
    const completes = ids.filter((id) => contenu.recettes[id].ingredients.length > 0 && contenu.recettes[id].etapes.length > 0)
    expect(completes.length / ids.length).toBeGreaterThan(0.95)
  })

  it('reste lisible en diff : une ligne par recette', () => {
    const texte = readFileSync(resolve(process.cwd(), 'scripts/data/prerender-contenu.json'), 'utf8').replace(/\r\n/g, '\n')
    for (const id of ids) expect(lireLaLigne(texte, id)).toEqual(contenu.recettes[id])
  })
})
