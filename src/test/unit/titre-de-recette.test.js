import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { titreDeRecette } from '@shared/lib/recipes/titre-de-recette'

// Décision du 2026-10-08 : « Risotto aux champignons : la recette — Fridge+ » —
// le nom d'abord, le mot cherché ensuite. Le titre affiché SUR la fiche ne change
// pas : seuls l'onglet et ce que lisent les moteurs (le HTML pré-rendu, en
// français) le portent. Une seule fonction, lue des deux côtés ; le HTML
// pré-rendu (`<title>` et `og:title`) est vérifié sur le vrai gabarit par
// `prerender-page.test.js`.

const NBSP = String.fromCharCode(0xa0)

describe('le titre d’une fiche recette', () => {
  it('en français : le nom, puis « la recette », avec l’espace insécable avant le deux-points', () => {
    expect(titreDeRecette('Risotto aux champignons', 'fr')).toBe(`Risotto aux champignons${NBSP}: la recette — Fridge+`)
  })

  it('en anglais : « <nom> recipe »', () => {
    expect(titreDeRecette('Mushroom risotto', 'en')).toBe('Mushroom risotto recipe — Fridge+')
  })

  it('le pré-rendu lit la même fonction, en français', () => {
    const script = readFileSync('scripts/lib/prerender-page.mjs', 'utf8')
    expect(script).toMatch(/titre: titreDeRecette\(nom, 'fr'\)/)
  })

  it('la page vivante pose le même titre, dans la langue affichée', () => {
    const source = readFileSync('src/features/recipes/pages/recipe-page.jsx', 'utf8')
    expect(source).toMatch(/titreDeRecette\(nomRecette, lang\)/)
  })
})
