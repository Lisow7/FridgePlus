import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockUseCloseOnBackButton = vi.hoisted(() => vi.fn())
vi.mock('@shared/hooks/use-close-on-back-button', () => ({ useCloseOnBackButton: mockUseCloseOnBackButton }))

// Mock recipe-modal.jsx directement pour éviter sa transformation par Vite
// (qui échoue sur l'import manquant de glossary-text).
// BaseRecipeOverlay ne teste que le wiring de RecipeModal (props, returnBanner, close);
// la logique interne de RecipeModal est déjà testée ailleurs.
vi.mock('@features/recipes/components/recipe-modal', () => ({
  default: ({ recipe, returnBanner, onClose, variant: _variant, lockedServings, lockedByLabel, lockedOriginServings }) => (
    <>
      {returnBanner && (
        <button onClick={returnBanner.onClick}>
          {returnBanner.label}
        </button>
      )}
      <div data-testid="recipe-name">{recipe?.name?.fr ?? recipe?.id}</div>
      <div data-testid="etapes">{recipe?.steps?.fr?.length ?? 0}</div>
      {lockedServings != null && <div data-testid="locked-servings">{lockedServings}</div>}
      {lockedByLabel != null && <div data-testid="locked-by-label">{lockedByLabel}</div>}
      {lockedOriginServings != null && <div data-testid="locked-origin-servings">{lockedOriginServings}</div>}
      <button data-testid="close-btn" onClick={onClose}>
        Close
      </button>
    </>
  ),
}))

// La fiche complète de la recette de base vient de useRecipeById : le catalogue
// n'a plus les étapes (audit du 2026-10-04, PERF-01).
const fiches = vi.hoisted(() => ({
  'bechamel-maison': {
    id: 'bechamel-maison', name: { fr: 'Béchamel maison' }, servings: 4,
    steps: { fr: ['Fondre le beurre.', 'Ajouter la farine, puis le lait.'] },
  },
}))
vi.mock('@features/recipes/hooks/use-recipe-by-id', () => ({
  useRecipeById: (id) => (fiches[id] ? { recipe: fiches[id], status: 'ok' } : { recipe: null, status: 'not-found' }),
}))

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useBaseRecipes: () => ({
    // recipeNames : seule source du nom d'une recette OFFICIELLE — rowsToRecipes()
    // (data-provider.jsx) ne mappe jamais `.name` sur l'objet recette lui-même
    // (vérifié en conditions réelles, Task 10 — cf. recipe-modal.jsx qui résout
    // pareil via RECIPE_NAMES[recipe.id] pour les recettes non-custom).
    recipeNames: { lasagnes: { fr: 'Lasagnes maison' } },
    recipes: [],
    recipesById: new Map([
      ['bechamel-maison', { id: 'bechamel-maison', name: { fr: 'Béchamel maison' }, servings: 4 }],
    ]),
  }),
  useCountries: () => ({}), useDietTypes: () => ({}), useAllergenTypes: () => ({}),
  useIngredientsById: () => new Map(), useGroupMaps: () => ({ groupMap: {}, parentMap: {} }),
}))

import BaseRecipeOverlay from '@features/recipes/components/base-recipe-overlay'

// Recette d'origine OFFICIELLE (isCustom absent/false) — son nom vit dans
// recipeNames, pas sur l'objet lui-même (contrairement à une recette custom).
const originRecipe = { id: 'lasagnes' }

function renderOverlay(props = {}) {
  return render(
    <MemoryRouter>
      <BaseRecipeOverlay
        recipeId="bechamel-maison" originRecipe={originRecipe} originServings={6} onClose={vi.fn()} lang="fr"
        stock={new Set()} favorites={new Set()} onToggleFavorite={() => {}}
        basketRecipeIds={new Set()} {...props}
      />
    </MemoryRouter>,
  )
}

describe('BaseRecipeOverlay', () => {
  it('affiche le bandeau de retour vers la recette d\'origine', () => {
    renderOverlay()
    expect(screen.getByText('Retour à Lasagnes maison')).toBeInTheDocument()
  })

  it('affiche la recette de base résolue', () => {
    renderOverlay()
    expect(screen.getByText('Béchamel maison')).toBeInTheDocument()
  })

  // La version du catalogue (sans étapes) ne suffit pas : l'aperçu montre la
  // fiche complète, comme la page d'une recette.
  it('montre la fiche complète de la recette de base, avec ses étapes', () => {
    renderOverlay()
    expect(screen.getByTestId('etapes')).toHaveTextContent('2')
  })

  it('clic sur le bandeau appelle onClose', () => {
    const onClose = vi.fn()
    renderOverlay({ onClose })
    fireEvent.click(screen.getByText('Retour à Lasagnes maison'))
    expect(onClose).toHaveBeenCalled()
  })

  it('branche useCloseOnBackButton(true, onClose)', () => {
    const onClose = vi.fn()
    renderOverlay({ onClose })
    expect(mockUseCloseOnBackButton).toHaveBeenCalledWith(true, onClose)
  })

  it('recipeId introuvable → ne rend rien (défensif)', () => {
    const { container } = renderOverlay({ recipeId: 'inconnu' })
    expect(container).toBeEmptyDOMElement()
  })

  it('recette d\'origine custom : résout le nom depuis son propre champ .name, pas recipeNames', () => {
    const customOrigin = { id: 'ma-recette-custom', isCustom: true, name: { fr: 'Ma recette perso' } }
    renderOverlay({ originRecipe: customOrigin })
    expect(screen.getByText('Retour à Ma recette perso')).toBeInTheDocument()
  })

  it('lang="en" : bandeau de retour en anglais', () => {
    renderOverlay({ lang: 'en' })
    expect(screen.getByText('Back to Lasagnes maison')).toBeInTheDocument()
  })

  it('recette d\'origine avec sub_recipes correspondant → transmet lockedServings/lockedByLabel/lockedOriginServings à RecipeModal', () => {
    const originWithSubRecipe = {
      id: 'lasagnes', servings: 6,
      ingredients: { groups: [], sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 0.75 }] },
    }
    render(
      <MemoryRouter>
        <BaseRecipeOverlay
          recipeId="bechamel-maison" originRecipe={originWithSubRecipe} originServings={8}
          onClose={vi.fn()} lang="fr" stock={new Set()} favorites={new Set()}
          onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('locked-servings')).toHaveTextContent('4')
    expect(screen.getByTestId('locked-by-label')).toHaveTextContent('Lasagnes maison')
    expect(screen.getByTestId('locked-origin-servings')).toHaveTextContent('8')
  })

  it('recette d\'origine sans sub_recipes correspondant → ne transmet aucune prop de verrouillage', () => {
    render(
      <MemoryRouter>
        <BaseRecipeOverlay
          recipeId="bechamel-maison" originRecipe={{ id: 'lasagnes', servings: 6 }} originServings={6}
          onClose={vi.fn()} lang="fr" stock={new Set()} favorites={new Set()}
          onToggleFavorite={() => {}} basketRecipeIds={new Set()}
        />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('locked-servings')).not.toBeInTheDocument()
  })
})
