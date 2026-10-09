import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Quand un panneau recouvre l'accueil (recettes, panier, support, admin, liste
// d'un bac), TROIS éléments flottants doivent s'effacer : la carte d'accueil,
// le bouton orange et la fusée « Bien démarrer ».
//
// Audit du 2026-10-04 (P-07). La carte et le bouton orange s'effaçaient, la
// fusée non : elle restait posée sur le panneau admin (par-dessus une
// corbeille de suppression), sur la liste d'aliments d'un bac, sur le panneau
// de recettes. La condition était écrite DEUX fois dans App.jsx, et la
// troisième copie manquait. Elle n'existe plus qu'une fois.
//
// Relevé du source, faute de mieux : App.jsx n'est pas montable dans un test
// unitaire, et la fusée dépend d'un drapeau que les tests de bout en bout
// laissent éteint.
const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')

describe('accueil recouvert par un panneau', () => {
  it('la condition n’est écrite qu’une fois, et compte les cinq surfaces', () => {
    const definitions = app.match(/const accueilCouvert = .*/g) ?? []
    expect(definitions).toHaveLength(1)
    for (const surface of ['showRecipes', 'modals.cart.isOpen', 'modals.support.isOpen', 'modals.admin.isOpen', 'activeSubcat']) {
      expect(definitions[0]).toContain(surface)
    }
    // Plus aucune copie de l'expression ailleurs.
    expect(app.match(/modals\.cart\.isOpen \|\| modals\.support\.isOpen/g)).toHaveLength(1)
    expect(app).not.toMatch(/!modals\.cart\.isOpen && !modals\.support\.isOpen/)
  })

  it('la carte d’accueil s’efface', () => {
    expect(app).toMatch(/coachCovered: accueilCouvert\b/)
  })

  it('le bouton orange s’efface', () => {
    expect(app).toMatch(/isHomeForFab=\{isHome && !accueilCouvert\}/)
  })

  it('la fusée « Bien démarrer » s’efface aussi', () => {
    const pied = app.slice(app.indexOf('<AppFooter'), app.indexOf('/>', app.indexOf('<AppFooter')))
    expect(pied).toMatch(/isHome=\{isHome && !accueilCouvert\}/)
  })
})
