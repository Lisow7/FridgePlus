import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({
    recipeNames: { 'bechamel-maison': { fr: 'Béchamel maison' }, 'veloute-classique': { fr: 'Velouté classique' }, 'veloute-champignons': { fr: 'Velouté de champignons' } },
    recipesById: new Map([
      ['bechamel-maison', { id: 'bechamel-maison' }],
      ['veloute-classique', { id: 'veloute-classique' }],
      ['veloute-champignons', { id: 'veloute-champignons' }],
    ]),
  }),
}))

import StepText from '@shared/ui/step-text'

describe('StepText', () => {
  it('rend un terme de glossaire comme bouton infobulle', () => {
    render(<StepText text="Émincer l'oignon." lang="fr" currentRecipeId="lasagnes" onOpenBaseRecipe={vi.fn()} />)
    expect(screen.getByRole('button', { name: /émincer/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /émincer/i }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/tranches très fines/i)
  })

  it('rend un lien recette de base (1 seule cible) et navigue au clic', () => {
    const onOpen = vi.fn()
    render(<StepText text="Prépare une béchamel." lang="fr" currentRecipeId="lasagnes" onOpenBaseRecipe={onOpen} />)
    const link = screen.getByRole('button', { name: /béchamel/i })
    fireEvent.click(link)
    expect(onOpen).toHaveBeenCalledWith('bechamel-maison')
  })

  it('recette de base pas encore créée → reste du texte simple', () => {
    render(<StepText text="Ajoute du pesto." lang="fr" currentRecipeId="lasagnes" onOpenBaseRecipe={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Ajoute du pesto.')).toBeInTheDocument()
  })

  it('garde-fou auto-lien : sur la fiche de la recette de base, pas de bouton', () => {
    render(<StepText text="Prépare une béchamel." lang="fr" currentRecipeId="bechamel-maison" onOpenBaseRecipe={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('texte sans terme → aucun bouton', () => {
    render(<StepText text="Mélanger le tout." lang="fr" currentRecipeId="lasagnes" onOpenBaseRecipe={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Mélanger le tout.')).toBeInTheDocument()
  })
})
