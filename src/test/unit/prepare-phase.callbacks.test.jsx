import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const confirmMock = vi.fn()
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({
  useConfirm: () => confirmMock,
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({}),
  useBaseRecipes: () => ({ recipes: [], recipeNames: {} }),
  // PreparePhase appelle useIngredientLookup() pour résoudre les labels et
  // rayons canoniques des ingrédients. Le mock retourne Maps vides → les
  // rows tombent sur le fallback `row.label` / `row.subcat`, ce qui est OK
  // pour les tests callbacks qui n'assertent pas le rayon.
  useIngredientLookup: () => ({ byId: new Map(), subcatById: new Map() }),
}))

import PreparePhase from '@features/cart/components/prepare-phase'

// Two recipes (spaghetti + césar) + one manual item (baguette).
// The manual item (row-4, recipe_id: null) renders without an accordion,
// so its label is always visible — useful to assert PackSelector wiring.
const fixtureBasket = [
  {
    id: 'row-1', recipe_id: 'spaghetti', recipe_name: 'Spaghetti',
    recipe_emoji: '🍝', recipe_servings: 2,
    ingredient_id: 'fr-tomate', label: 'Tomates', amount: 200, unit: 'g', price: 1.20,
  },
  {
    id: 'row-2', recipe_id: 'spaghetti', recipe_name: 'Spaghetti',
    recipe_emoji: '🍝', recipe_servings: 2,
    ingredient_id: 'fr-pates', label: 'Pâtes', amount: 250, unit: 'g', price: 0.80,
  },
  {
    id: 'row-3', recipe_id: 'cesar', recipe_name: 'Salade César',
    recipe_emoji: '🥗', recipe_servings: 4,
    ingredient_id: 'fr-tomate', label: 'Tomates', amount: 300, unit: 'g', price: 1.80,
  },
  {
    id: 'row-4', recipe_id: null, recipe_name: null, recipe_emoji: null,
    ingredient_id: 'fr-pain', label: 'Baguette', amount: 2, unit: 'pcs', price: 1.50,
  },
]

function renderPhase(overrides = {}) {
  const callbacks = {
    onUpdateServings: vi.fn(),
    onRemoveRecipe: vi.fn(),
    onRemoveItem: vi.fn(),
    onChangeItemPack: vi.fn(),
    onClearBasket: vi.fn(),
    onSaveList: vi.fn(),
    onLoadList: vi.fn(),
    onManualAdd: vi.fn(),
    onAddToCart: vi.fn(),
    onShowRecipes: vi.fn(),
    onShowSources: vi.fn(),
    onStartShopping: vi.fn(),
    ...overrides,
  }
  render(
    <PreparePhase
      basket={fixtureBasket}
      lang="fr"
      darkMode={false}
      userId="test-user"
      totalPrice={5.30}
      {...callbacks}
    />
  )
  return callbacks
}

describe('PreparePhase — callbacks baseline (anti-regression)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('onUpdateServings: stepper augmenter les portions', () => {
    const cb = renderPhase()
    // aria-label="Augmenter les portions" — one per recipe group
    fireEvent.click(screen.getAllByLabelText(/augmenter les portions/i)[0])
    expect(cb.onUpdateServings).toHaveBeenCalledTimes(1)
    // Called with (recipe_id, newServings). newServings = 2+1 = 3.
    expect(cb.onUpdateServings).toHaveBeenCalledWith('spaghetti', 3)
  })

  it('onUpdateServings: stepper diminuer les portions', () => {
    const cb = renderPhase()
    fireEvent.click(screen.getAllByLabelText(/diminuer les portions/i)[0])
    expect(cb.onUpdateServings).toHaveBeenCalledTimes(1)
    // Math.max(1, 2-1) = 1
    expect(cb.onUpdateServings).toHaveBeenCalledWith('spaghetti', 1)
  })

  it('onRemoveRecipe: corbeille recette', () => {
    const cb = renderPhase()
    // aria-label="Retirer Spaghetti" — target recipe by name (layout-order agnostic)
    fireEvent.click(screen.getByLabelText(/retirer spaghetti/i))
    expect(cb.onRemoveRecipe).toHaveBeenCalled()
    expect(cb.onRemoveRecipe).toHaveBeenCalledWith('spaghetti')
  })

  it('onRemoveItem: croix article manuel Baguette', () => {
    const cb = renderPhase()
    // Manual item remove: aria-label="Retirer Baguette"
    fireEvent.click(screen.getByLabelText(/^retirer baguette$/i))
    expect(cb.onRemoveItem).toHaveBeenCalledWith('row-4')
  })

  it('onChangeItemPack: PackSelector wiring — Baguette row visible', () => {
    // PackSelector renders as a button with aria-label "Choisir un conditionnement : Baguette"
    // and the formatted quantity in its text content (e.g. "2 pcs").
    // This assertion confirms PackSelector is wired into the manual item row.
    renderPhase()
    expect(screen.getByRole('button', { name: /choisir un conditionnement.*baguette/i })).toBeInTheDocument()
  })

  it('onClearBasket: bouton Vider + useConfirm', async () => {
    const cb = renderPhase()
    confirmMock.mockResolvedValue(true)
    // aria-label="Vider la liste ?" wins over text "Vider" as accessible name;
    // /vider/i matches both, so getByRole with name works.
    fireEvent.click(screen.getByRole('button', { name: /vider/i }))
    await Promise.resolve()
    await Promise.resolve()
    expect(cb.onClearBasket).toHaveBeenCalled()
  })

  it('onClearBasket: annuler via useConfirm → ne vide pas', async () => {
    const cb = renderPhase()
    confirmMock.mockResolvedValue(false)
    fireEvent.click(screen.getByRole('button', { name: /vider/i }))
    await Promise.resolve()
    await Promise.resolve()
    expect(cb.onClearBasket).not.toHaveBeenCalled()
  })

  it('onSaveList: bouton Sauvegarder ouvre la modale (pas encore appelé)', () => {
    const cb = renderPhase()
    fireEvent.click(screen.getByRole('button', { name: /sauvegarder/i }))
    // onSaveList is called only when the modal is submitted, not on open.
    expect(cb.onSaveList).not.toHaveBeenCalled()
  })

  it('onLoadList: bouton Mes listes ouvre la modale (pas encore appelé)', () => {
    const cb = renderPhase()
    fireEvent.click(screen.getByRole('button', { name: /mes listes/i }))
    expect(cb.onLoadList).not.toHaveBeenCalled()
  })

  it('onManualAdd: bouton Ajouter un article ouvre la sheet (pas encore appelé)', () => {
    const cb = renderPhase()
    fireEvent.click(screen.getByRole('button', { name: /ajouter un article/i }))
    // onManualAdd is called from within AddItemSheet when item is confirmed.
    expect(cb.onManualAdd).not.toHaveBeenCalled()
  })

  it('onStartShopping: CTA Commencer les courses', () => {
    const cb = renderPhase()
    fireEvent.click(screen.getByRole('button', { name: /commencer les courses/i }))
    expect(cb.onStartShopping).toHaveBeenCalledTimes(1)
  })

  it('onShowSources: prop passée à CartBudgetBar sans crash', () => {
    const onShowSources = vi.fn()
    renderPhase({ onShowSources })
    // CartBudgetBar shows the "Sources" link only when totalPrice > 0.
    // totalPrice=5.30, so the link renders.
    const sourcesBtn = screen.getByText(/sources/i)
    fireEvent.click(sourcesBtn)
    expect(onShowSources).toHaveBeenCalledTimes(1)
  })

  it('onShowRecipes / onAddToCart: empty basket renders EmptyBasketState sans crash', () => {
    const callbacks = {
      onUpdateServings: vi.fn(), onRemoveRecipe: vi.fn(), onRemoveItem: vi.fn(),
      onChangeItemPack: vi.fn(), onClearBasket: vi.fn(), onSaveList: vi.fn(),
      onLoadList: vi.fn(), onManualAdd: vi.fn(),
      onAddToCart: vi.fn(), onShowRecipes: vi.fn(), onShowSources: vi.fn(),
      onStartShopping: vi.fn(),
    }
    // userId=null to avoid Supabase calls in EmptyBasketState's useEffect.
    render(
      <PreparePhase
        basket={[]}
        lang="fr"
        darkMode={false}
        userId={null}
        totalPrice={0}
        {...callbacks}
      />
    )
    // EmptyBasketState mounts — assert it renders its empty-state heading.
    expect(screen.getByText(/ton panier est vide/i)).toBeInTheDocument()
  })
})

describe('PreparePhase — vider la liste', () => {
  it('appelle useConfirm() avec le titre danger avant de vider', async () => {
    confirmMock.mockResolvedValue(true)
    const onClearBasket = vi.fn()
    render(<PreparePhase basket={fixtureBasket} lang="fr" darkMode={false} onClearBasket={onClearBasket} />)
    fireEvent.click(screen.getByText('Vider'))
    await Promise.resolve()
    await Promise.resolve()
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Vider la liste ?',
      danger: true,
    }))
    expect(onClearBasket).toHaveBeenCalled()
  })

  it('ne vide pas si l\'utilisateur annule', async () => {
    confirmMock.mockResolvedValue(false)
    const onClearBasket = vi.fn()
    render(<PreparePhase basket={fixtureBasket} lang="fr" darkMode={false} onClearBasket={onClearBasket} />)
    fireEvent.click(screen.getByText('Vider'))
    await Promise.resolve()
    await Promise.resolve()
    expect(onClearBasket).not.toHaveBeenCalled()
  })
})
