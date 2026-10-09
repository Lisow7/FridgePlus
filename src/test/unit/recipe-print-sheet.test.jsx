import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecipePrintSheet from '@features/recipes/components/recipe-print-sheet'

// Fiche imprimable d'une recette. Remplace `buildRecipePrintHtml`, qui
// assemblait une chaîne HTML (audit 2026-10-04, SEC-01 : le champ `emoji` y
// était inséré sans échappement).
//
// 🔴 La recette ci-dessous a la FORME RÉELLE d'une recette officielle telle que
// la fiche la reçoit : pas de `name` sur l'objet (le nom vient de
// `RECIPE_NAMES`, résolu par l'appelant), et `time` DÉJÀ suffixé (« 5 min »).
// L'ancien test utilisait `name: { fr }` et `time: 10` : il passait pendant que
// la production imprimait une fiche sans nom et « 5 min min ».
const officielle = {
  id: 'affogato', emoji: '☕', time: '5 min', difficulty: 'Très facile', servings: 2,
  ingredients: [
    { ids: ['fr-glace-vanille'], labels: { fr: 'Glace vanille' }, qty: { amount: 2, unit: 'pcs' }, required: true },
    { ids: ['gp-cafe'], labels: { fr: 'Café' }, qty: { amount: 60, unit: 'ml' }, required: true },
  ],
}
const etapes = ['Préparer un espresso.', 'Verser sur la glace.']

describe('RecipePrintSheet', () => {
  it('affiche le nom transmis par l’appelant en titre', () => {
    render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Affogato')
  })

  it('n’ajoute pas « min » à un temps déjà suffixé', () => {
    const { container } = render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    expect(container.textContent).toContain('5 min')
    expect(container.textContent).not.toContain('min min')
  })

  it('liste les ingrédients avec leurs quantités', () => {
    const { container } = render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    expect(container.textContent).toContain('Glace vanille')
    expect(container.textContent).toContain('Café')
    expect(container.textContent).toMatch(/60/)
  })

  it('numérote les étapes transmises', () => {
    render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    const items = screen.getAllByRole('listitem').filter(li => li.closest('ol'))
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Préparer un espresso.')
  })

  it('n’inclut ni statut frigo ni progression', () => {
    const { container } = render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    expect(container.textContent).not.toMatch(/frigo|Manquant/i)
  })

  it('rend un champ piégé comme du TEXTE : aucune balise n’en sort', () => {
    const piege = '<script src="//cdn.exemple/x.js"></script><img src=x onerror=alert(1)>'
    const { container } = render(
      <RecipePrintSheet
        recipe={{ ...officielle, emoji: piege, difficulty: piege }}
        name={piege}
        steps={[piege]}
        lang="fr"
      />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(piege)
  })

  it('ne contient aucun script : c’est l’appelant qui lance l’impression', () => {
    const { container } = render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="fr" />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('se rend en anglais', () => {
    const { container } = render(<RecipePrintSheet recipe={officielle} name="Affogato" steps={etapes} lang="en" />)
    expect(container.textContent).toContain('Ingredients')
    expect(container.textContent).toContain('Preparation')
  })
})
