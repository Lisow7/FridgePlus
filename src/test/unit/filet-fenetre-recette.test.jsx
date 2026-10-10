import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Décision du 2026-10-08 (audit du 2026-10-04, filet des écrans) : si la fenêtre
// « Créer une recette » plantait, TOUTE l'app passait à l'écran « Une erreur est
// survenue », qui proposait de recharger la page. Désormais, un filet propre à la
// fenêtre : « Réessayer » la rouvre (avec le brouillon, en création) ; « Fermer »
// rend l'app là où on était. En modification, le message dit que les
// changements n'ont pas pu être gardés. Textes de la maquette validée.

const m = vi.hoisted(() => ({ logError: vi.fn(), close: vi.fn(), recette: { showForm: true, editRecipe: null }, planter: { actif: false } }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: 'fr' }) }))
vi.mock('@shared/lib/observability/sentry', () => ({ logError: m.logError }))
vi.mock('@shared/contexts/recipe-form-context', () => ({
  useRecipeForm: () => ({ showForm: m.recette.showForm, editRecipe: m.recette.editRecipe, close: m.close }),
}))
// La fenêtre de recette plante tant que `planter.actif` (React rejoue le rendu
// une fois après une erreur : un « une seule fois » serait déjoué).
vi.mock('@features/recipes/components/recipe-form-modal', () => ({
  default: () => {
    if (m.planter.actif) throw new Error('la fenêtre plante')
    return <div role="dialog" aria-label="Créer une recette">formulaire</div>
  },
}))

import FiletDeLaFenetreRecette from '@app/components/filet-fenetre-recette'
import RecipeFormOverlay from '@app/components/recipe-form-overlay'

beforeEach(() => {
  m.logError.mockReset()
  m.close.mockReset()
  m.recette = { showForm: true, editRecipe: null }
  m.planter.actif = false
  vi.spyOn(console, 'error').mockImplementation(() => {}) // React journalise l'erreur attrapée
})

describe('le filet de la fenêtre de recette', () => {
  it('en création : la fenêtre dit son problème, et que le brouillon est gardé', async () => {
    m.planter.actif = true
    render(<RecipeFormOverlay onSave={vi.fn()} lang="fr" darkMode={false} />)
    expect(await screen.findByRole('dialog', { name: 'Créer une recette' })).toHaveTextContent('La fenêtre a rencontré un problème')
    expect(screen.getByRole('alert')).toHaveTextContent('La fenêtre a rencontré un problème')
    expect(screen.getByText('Ton brouillon est gardé sur cet appareil.')).toBeInTheDocument()
    expect(m.logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ tag: 'error-boundary.recipe-form' }))
  })

  it('« Réessayer » rouvre la fenêtre', async () => {
    m.planter.actif = true
    render(<RecipeFormOverlay onSave={vi.fn()} lang="fr" darkMode={false} />)
    const reessayer = await screen.findByRole('button', { name: 'Réessayer' })
    m.planter.actif = false // ce qui plantait ne plante plus
    fireEvent.click(reessayer)
    await waitFor(() => expect(screen.getByText('formulaire')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('« Fermer » rend l’app là où on était', async () => {
    m.planter.actif = true
    render(<RecipeFormOverlay onSave={vi.fn()} lang="fr" darkMode={false} />)
    // Le bouton, et la touche Échap : les deux ferment. Le focus est sur « Réessayer ».
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(m.close).toHaveBeenCalledTimes(2)
  })

  it('en modification : le message dit que les changements n’ont pas pu être gardés', async () => {
    m.planter.actif = true
    m.recette = { showForm: true, editRecipe: { id: 'r-1', name: 'Risotto' } }
    render(<RecipeFormOverlay onSave={vi.fn()} lang="fr" darkMode={false} />)
    expect(await screen.findByRole('dialog', { name: 'Modifier la recette' })).toBeInTheDocument()
    expect(screen.getByText('Tes changements n’ont pas pu être gardés.')).toBeInTheDocument()
    expect(screen.queryByText('Ton brouillon est gardé sur cet appareil.')).toBeNull()
  })

  it('en anglais aussi', () => {
    function Boum() { throw new Error('boum') }
    render(<FiletDeLaFenetreRecette lang="en" onFermer={vi.fn()}><Boum /></FiletDeLaFenetreRecette>)
    expect(screen.getByRole('alert')).toHaveTextContent('The window ran into a problem')
    expect(screen.getByText('Your draft is kept on this device.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
