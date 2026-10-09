import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecipeShareSheet from '@features/recipes/components/recipe-share-sheet'

vi.mock('@shared/hooks/use-qr-code', () => ({ useQrCode: () => 'data:image/png;base64,XX' }))
import RecipePrintSheet from '@features/recipes/components/recipe-print-sheet'

const printSpy = vi.fn()
vi.mock('@shared/lib/print/print-element', () => ({ printReactElement: (...a) => printSpy(...a) }))

const recipe = { id: 'caprese', name: { fr: 'Caprese' } }

describe('RecipeShareSheet', () => {
  it('rend Imprimer toujours', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="x" isShareable={false} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /imprimer/i })).toBeInTheDocument()
  })
  it('cache Copier le lien et QR si non partageable', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="x" isShareable={false} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /copier le lien/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /qr/i })).not.toBeInTheDocument()
  })
  it('montre Copier + QR si partageable', () => {
    render(<RecipeShareSheet open recipe={recipe} lang="fr" shareUrl="https://x/recipe/caprese" isShareable onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /copier le lien/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /qr/i })).toBeInTheDocument()
  })
  it('imprime au clic Imprimer : la fiche reçoit le nom et les étapes AFFICHÉS', () => {
    // Le nom d'une recette officielle n'est pas sur l'objet `recipe` : la
    // fenêtre le résout (RECIPE_NAMES) et le transmet. Sans ce passage, la
    // fiche imprimée n'avait pas de titre (constaté en production le 04/10).
    render(
      <RecipeShareSheet
        open recipe={recipe} recipeName="Salade Caprese" recipeSteps={['Trancher.', 'Dresser.']}
        lang="fr" shareUrl="x" isShareable onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /imprimer/i }))
    expect(printSpy).toHaveBeenCalledOnce()
    const element = printSpy.mock.calls[0][0]
    expect(element.type).toBe(RecipePrintSheet)
    expect(element.props).toMatchObject({ recipe, name: 'Salade Caprese', steps: ['Trancher.', 'Dresser.'], lang: 'fr' })
  })
})
