// Tests unit — RecipeCostTab (vue de l'onglet Coût), extrait de recipe-modal.jsx
// (audit front §2). On mocke computeCostRows pour contrôler les lignes ; le reste
// (recipe-utils, formatPrice, COST_MODES) est réel.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/info-tooltip', () => ({ default: () => null }))
vi.mock('@features/recipes/lib/recipe-cost-rows', () => ({ computeCostRows: vi.fn() }))

import RecipeCostTab from '@features/recipes/components/recipe-cost-tab'
import { computeCostRows } from '@features/recipes/lib/recipe-cost-rows'
import { COST_MODES } from '@shared/lib/recipes/recipe-utils'

const t = {
  costBreakdownLabel: 'Coût par ingrédient', costRefreshBtn: '↻ Actualiser', costRefreshing: 'Actualisation…',
  costLabel: 'Coût', costModeTotal: 'Total', costModePerServing: 'Par portion', costModeMarginal: 'À acheter',
  costPerServingLabel: 'Par portion', costMarginalLabel: 'En plus', costTotal: 'Recette complète',
  costRecipeNote: 'ligne1\n\nligne2', costNoData: 'Prix non disponibles', costOptionalNote: '* optionnel',
  costLiveSource: 'Open Prices', costLiveBadge: 'live', costEstimated: 'Estimé', costLastUpdated: (hm) => `Actualisé à ${hm}`,
}

const makeCost = (over = {}) => ({
  costMode: COST_MODES.TOTAL, setCostMode: vi.fn(), livePrices: {}, liveLoading: false, liveUpdatedAt: null, refresh: vi.fn(), ...over,
})
const baseProps = { recipe: {}, lang: 'fr', ingredientsById: new Map(), stock: new Set(), scaleFactor: 1, t }

beforeEach(() => vi.clearAllMocks())

describe('RecipeCostTab', () => {
  it('affiche le titre et les lignes de coût', () => {
    computeCostRows.mockReturnValue([
      { label: 'Beurre', qtyStr: '100 g', itemPrice: 2, inStock: false, required: true, isLive: false },
      { label: 'Sel', qtyStr: '2 g', itemPrice: null, inStock: true, required: false, isLive: false },
    ])
    render(<RecipeCostTab {...baseProps} cost={makeCost()} />)
    expect(screen.getByText('Coût par ingrédient')).toBeInTheDocument()
    expect(screen.getByText('Beurre')).toBeInTheDocument()
    expect(screen.getByText('Sel')).toBeInTheDocument()
  })

  it('affiche le sélecteur de mode (3 options) quand au moins un prix existe', () => {
    computeCostRows.mockReturnValue([{ label: 'Beurre', qtyStr: '100 g', itemPrice: 2, inStock: false, required: true, isLive: false }])
    render(<RecipeCostTab {...baseProps} cost={makeCost()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByText('Par portion')).toBeInTheDocument()
    expect(screen.getByText('À acheter')).toBeInTheDocument()
  })

  it('clique un mode → appelle setCostMode', () => {
    computeCostRows.mockReturnValue([{ label: 'Beurre', qtyStr: '100 g', itemPrice: 2, inStock: false, required: true, isLive: false }])
    const cost = makeCost()
    render(<RecipeCostTab {...baseProps} cost={cost} />)
    fireEvent.click(screen.getByText('À acheter'))
    expect(cost.setCostMode).toHaveBeenCalledWith(COST_MODES.MARGINAL)
  })

  it('clique « Actualiser » → appelle refresh(recipe, lang)', () => {
    computeCostRows.mockReturnValue([{ label: 'Beurre', qtyStr: '100 g', itemPrice: 2, inStock: false, required: true, isLive: false }])
    const cost = makeCost()
    render(<RecipeCostTab {...baseProps} cost={cost} />)
    fireEvent.click(screen.getByText('↻ Actualiser'))
    expect(cost.refresh).toHaveBeenCalled()
  })

  it('affiche le message « pas de prix » quand aucune ligne n\'a de prix', () => {
    computeCostRows.mockReturnValue([{ label: 'Sel', qtyStr: '2 g', itemPrice: null, inStock: true, required: false, isLive: false }])
    render(<RecipeCostTab {...baseProps} cost={makeCost()} />)
    expect(screen.getByText('Prix non disponibles')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })
})
