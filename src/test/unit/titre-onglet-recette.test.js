import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RECIPES } from '@shared/static/recipes'
import { RECIPE_NAMES } from '@shared/static/recipe-names'

// Le titre de l'onglet sur une page recette.
//
// ── Le défaut, constaté EN PRODUCTION le 2026-08-21 ───────────────────────
// Le HTML servi pour `/recipe/:id` porte bien « <nom> — Fridge+ » : `curl` le
// montre. Mais dans un navigateur qui a déjà visité le site, l'onglet affichait
// « Fridge+ — Gérez votre frigo… ».
//
// La cause n'est ni le pré-rendu ni `useSeoMeta` : c'est le SERVICE WORKER. Son
// `navigateFallback` sert `index.html` depuis le cache pour toute navigation
// (la denylist ne couvre que `/api` et `/auth`), et cette coquille porte le
// titre générique. Le canonical de la recette n'arrive donc JAMAIS dans le DOM,
// et `useSeoMeta` — qui s'en sert comme signal — applique les métadonnées
// génériques, à raison.
//
// 🥇 **Un symptôme dans le navigateur ne prouve rien sur ce que le serveur
// envoie.** La comparaison de `useSeoMeta` était juste, ses valeurs aussi ;
// c'est l'entrée qui manquait. Chercher le coupable dans le code aurait mené à
// « corriger » une logique saine.
//
// ⚠️ Aucune conséquence SEO : les robots n'installent pas de service worker et
// reçoivent le fichier pré-rendu. C'est l'utilisateur qui y perdait — plusieurs
// onglets de recettes portaient tous le même nom.
//
// ── Ce que ce test verrouille ─────────────────────────────────────────────
// Le correctif tient en deux lignes faciles à supprimer par mégarde, et son
// absence ne casse rien de visible en test : exactement le profil d'un
// garde-fou qui disparaît sans bruit.

const SOURCE = readFileSync(resolve(process.cwd(), 'src/features/recipes/pages/recipe-page.jsx'), 'utf8')

// Commentaires retirés AVANT toute recherche : celui du correctif nomme les
// deux fonctions cherchées ci-dessous.
const source = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('page recette — le titre de l’onglet', () => {
  it('pose le nom de la recette dans le titre', () => {
    expect(source).toMatch(/useDocumentTitle\(/)
    // 🔴 Le nom des recettes de base vit dans une MAP SÉPARÉE. Ce test-ci a
    // d'abord été écrit comme `toMatch(/pickRecipeName\(recipe/)` — il passait
    // au vert pendant que l'onglet affichait « carbonara » au lieu de « Pasta
    // Carbonara ». Vérifier qu'une fonction est APPELÉE ne dit rien de ce
    // qu'elle rend.
    expect(source).toMatch(/RECIPE_NAMES\?\.\[recipe\.id\]/)
  })

  it('suit la langue affichée', () => {
    // Le pré-rendu est figé en français ; le titre affiché, lui, doit suivre la
    // langue de l'utilisateur — même règle que sur `/faq` et `/guide`.
    expect(source).toMatch(/RECIPE_NAMES\?\.\[recipe\.id\]\?\.\[lang\]/)
  })

  it('gère aussi les recettes créées par un utilisateur', () => {
    // Elles, portent bien leur nom dans l'objet — la map ne les contient pas.
    expect(source).toMatch(/recipe\.isCustom \? \(recipe\.name/)
  })

  it('appelle le hook AVANT tout retour conditionnel', () => {
    // 🔴 La règle des hooks : un `return` anticipé au-dessus rendrait l'appel
    // conditionnel, et React casserait à l'exécution — jamais au build.
    const lignes = source.split('\n')
    const iHook = lignes.findIndex(l => l.includes('useDocumentTitle('))
    const iPremierReturn = lignes.findIndex(l => /^\s*if \(status ===/.test(l))
    expect(iHook).toBeGreaterThan(-1)
    expect(iPremierReturn).toBeGreaterThan(-1)
    expect(iHook).toBeLessThan(iPremierReturn)
  })

  it('ne touche ni au canonical ni aux og:*', () => {
    // Ils appartiennent au HTML servi. Les réécrire côté client rouvrirait le
    // bug du canonical transversal du 2026-08-13.
    expect(source).not.toMatch(/rel="canonical"/)
    expect(source).not.toMatch(/og:url/)
  })
})

describe('la source du nom — le piège qui a fait passer un test au vert', () => {
  it('les recettes de base ne portent PAS leur nom dans l’objet', () => {
    // C'est la cause du défaut : `RECIPES` n'a ni `name` ni `title`. Toute
    // résolution qui lit `recipe.name` sur une recette de base retombe sur le
    // fallback, c'est-à-dire l'identifiant.
    const carbonara = RECIPES.find(r => r.id === 'carbonara')
    expect(carbonara, 'la recette carbonara doit exister').toBeTruthy()
    expect(carbonara.name).toBeUndefined()
  })

  it('leur nom vit dans RECIPE_NAMES, par langue', () => {
    expect(RECIPE_NAMES.carbonara?.fr).toBe('Pasta Carbonara')
    // Et surtout : ce n'est PAS l'identifiant. C'est exactement ce que
    // l'utilisateur voyait dans son onglet.
    expect(RECIPE_NAMES.carbonara?.fr).not.toBe('carbonara')
  })

  it('la map couvre toutes les recettes de base', () => {
    const sansNom = RECIPES.filter(r => !RECIPE_NAMES[r.id]?.fr)
    expect(sansNom.map(r => r.id)).toEqual([])
  })
})
