import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipeWithdrawBody } from '@features/recipes/components/recipe-withdraw-view'

// Lot 9f (complément d'audit, trouvé par balayage de l'arbre JSX) : à l'écran
// « J'ai cuisiné », chaque ingrédient à retirer du frigo se cochait par une
// `div` cliquable, avec une case DESSINÉE. Au clavier, rien ne se cochait ; le
// lecteur d'écran ne disait ni « case à cocher » ni son état.

const T = new Proxy({}, { get: (_, cle) => String(cle) })
const RECETTE = { ingredients: [
  { ids: ['fr-beurre-doux'], labels: { fr: 'Beurre' }, required: true },
  { ids: ['gp-farine'], labels: { fr: 'Farine' }, required: true },
] }
const LEXIQUE = {
  'fr-beurre-doux': { labels: { fr: 'Beurre doux' }, emoji: '🧈' },
  'gp-farine': { labels: { fr: 'Farine de blé' }, emoji: '🌾' },
}

function Banc() {
  const [etat, setEtat] = useState({ 0: { checked: true, resolved: 'fr-beurre-doux' }, 1: { checked: false, resolved: 'gp-farine' } })
  return (
    <RecipeWithdrawBody recipe={RECETTE} stepTwoState={etat} setStepTwoState={setEtat} canConfirm
      confirmWithdraw={() => {}} ingredientLookup={LEXIQUE} mutedColor="#666" lang="fr" t={T} />
  )
}

describe('« J’ai cuisiné » : les ingrédients se cochent au clavier', () => {
  it('chaque ingrédient est une vraie case à cocher, nommée, qui dit son état', () => {
    render(<Banc />)
    expect(screen.getByRole('checkbox', { name: /Beurre doux/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Farine de blé/ })).not.toBeChecked()
  })

  it('Tab l’atteint, Espace la bascule', async () => {
    const user = userEvent.setup()
    render(<Banc />)
    const farine = screen.getByRole('checkbox', { name: /Farine de blé/ })
    farine.focus()
    expect(farine).toHaveFocus()
    await user.keyboard(' ')
    expect(farine).toBeChecked()
  })

  it('un clic n’importe où sur la ligne bascule toujours (une seule fois)', async () => {
    const user = userEvent.setup()
    render(<Banc />)
    await user.click(screen.getByText('Beurre doux'))
    expect(screen.getByRole('checkbox', { name: /Beurre doux/ })).not.toBeChecked()
  })
})
