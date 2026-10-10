import { useState, useMemo } from 'react'
import { LuPlus, LuSave, LuList, LuEraser, LuArrowRight } from 'react-icons/lu'
import CartBudgetBar from './cart-budget-bar'
import AddItemSheet from './add-item-sheet'
import SaveShoppingListModal from './save-shopping-list-modal'
import ShoppingListsModal from './shopping-lists-modal'
import EmptyBasketState from './empty-basket-state'
import PrepareIngredientRow from './prepare-ingredient-row'
import PrepareRecipeChip from './prepare-recipe-chip'
import { groupByRecipe, groupByAisleConsolidated, computeBasketBudget } from '@features/cart/lib/cart-helpers'
import { useIngredientLookup } from '@shared/contexts/data-provider'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'
import { suffixS } from '@shared/lib/i18n/pluralize'

const I18N = {
  fr: {
    recipes: 'Recettes',
    ingredients: 'Ingrédients',
    itemsCount: (n) => `· ${n} article${n > 1 ? 's' : ''}`,
    recipesCount: (n) => `· ${n} recette${n > 1 ? 's' : ''}`,
    expandAll: 'Tout déployer ↓',
    collapseAll: 'Tout replier ↑',
    addItem: 'Ajouter un article',
    save: 'Sauvegarder',
    myLists: 'Mes listes',
    clear: 'Vider',
    clearConfirm: 'Vider la liste ?',
    persons: (n) => `${n} pers.`,
    startShopping: 'Commencer les courses',
  },
  en: {
    recipes: 'Recipes',
    ingredients: 'Ingredients',
    itemsCount: (n) => `· ${n} item${suffixS(n, 'en')}`,
    recipesCount: (n) => `· ${n} recipe${suffixS(n, 'en')}`,
    expandAll: 'Expand all ↓',
    collapseAll: 'Collapse all ↑',
    addItem: 'Add an item',
    save: 'Save',
    myLists: 'My lists',
    clear: 'Clear',
    clearConfirm: 'Clear the list?',
    persons: (n) => `${n} pers.`,
    startShopping: 'Start shopping',
  },
}

// PreparePhase — Phase 1 : construire et optimiser la liste.
// Vue ingrédients consolidés par rayon (principale) + recettes en section secondaire compacte.
export default function PreparePhase({
  basket,
  lang,
  darkMode,
  userId,
  onUpdateServings,
  onRemoveItem,
  onRemoveRecipe,
  onClearBasket,
  onSaveList,
  onLoadList,
  onManualAdd,
  onAddToCart,
  onShowRecipes,
  onShowSources,
  onStartShopping,
  onRemoveAllByIngredient,
}) {
  const t = I18N[lang] ?? I18N.fr
  const confirm = useConfirm()
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [listsOpen, setListsOpen] = useState(false)
  const [collapsedAisles, setCollapsedAisles] = useState(() => new Set())
  const [allCollapsed, setAllCollapsed] = useState(false)
  // Choix de pack PAR INGRÉDIENT consolidé (état UI, jamais écrit dans les rows
  // — c'est ce qui corrige BUG-A8 : écrire le pack dans chaque row source
  // multipliait quantité + prix pour les ingrédients multi-recettes).
  // Forme : { [ingredient_id]: { pack: {size,unit,price}, multiplier } }.
  const [packChoices, setPackChoices] = useState({})

  const lookup = useIngredientLookup()
  const groups = groupByRecipe(basket)
  const aisles = useMemo(
    () => groupByAisleConsolidated(basket, lookup?.byId, lang, lookup?.subcatById),
    [basket, lookup, lang]
  )
  // Budget = somme des prix d'achat consolidés (pack choisi → prix réel,
  // sinon coût basé sur la quantité nécessaire). Reflète le sur-achat.
  const budget = useMemo(() => computeBasketBudget(aisles, packChoices), [aisles, packChoices])

  const setIngredientPack = (ingredientId, patch) =>
    setPackChoices(prev => ({ ...prev, [ingredientId]: { ...(prev[ingredientId] ?? {}), ...patch } }))
  const ingredientsTotalCount = useMemo(
    () => aisles.reduce((acc, g) => acc + g.ingredients.length, 0),
    [aisles]
  )
  const hasContent = groups.length > 0 || basket.some(i => !i.recipe_id)

  const muted = darkMode ? '#7A90A8' : '#8A6A60'
  const cardBg = darkMode ? '#131E2C' : '#fff'
  const cardBorder = darkMode ? '#1A2A3D' : 'rgba(0,0,0,0.08)'

  const toggleAisle = (aisle) => {
    if (allCollapsed) {
      // Exit global-collapse mode while keeping all other aisles collapsed.
      setAllCollapsed(false)
      setCollapsedAisles(new Set(aisles.map(g => g.aisle).filter(a => a !== aisle)))
      return
    }
    setCollapsedAisles(prev => {
      const next = new Set(prev)
      if (next.has(aisle)) next.delete(aisle); else next.add(aisle)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {hasContent ? (
        <>
          {/* ── Ingrédients (vue principale, par rayon) ── */}
          {aisles.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: muted }}>
                  {t.ingredients}  {t.itemsCount(ingredientsTotalCount)}
                </p>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(v => !v)}
                  className="text-[11px] font-bold text-[#D46A10] underline"
                >
                  {allCollapsed ? t.expandAll : t.collapseAll}
                </button>
              </div>
              {aisles.map(group => {
                const isCollapsed = collapsedAisles.has(group.aisle) || allCollapsed
                return (
                  <div key={group.aisle} className="rounded-md border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5EDE0] sticky top-0 z-10 text-left"
                      onClick={() => toggleAisle(group.aisle)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="text-base">{group.aisleEmoji}</span>
                      <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: '#D46A10' }}>
                        {group.aisleLabel}
                      </span>
                      <span className="text-[11px]" style={{ color: muted }}>({group.ingredients.length})</span>
                      <span className="ml-auto text-[#8A6A60]">{isCollapsed ? '▸' : '▾'}</span>
                    </button>
                    {!isCollapsed && group.ingredients.map(ing => (
                      <PrepareIngredientRow
                        key={ing.ingredient_id + ing.unit}
                        ingredient={ing}
                        lang={lang}
                        darkMode={darkMode}
                        onRemoveItem={onRemoveItem}
                        onRemoveAllByIngredient={onRemoveAllByIngredient}
                        currentPack={packChoices[ing.ingredient_id]?.pack ?? null}
                        packMultiplier={packChoices[ing.ingredient_id]?.multiplier ?? 1}
                        onChangePack={(pack) => setIngredientPack(ing.ingredient_id, { pack })}
                        onChangeMultiplier={(m) => setIngredientPack(ing.ingredient_id, { multiplier: m })}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Recettes (section secondaire compacte) ── */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: muted }}>
                {t.recipes}  {t.recipesCount(groups.length)}
              </p>
              {groups.map(group => (
                <PrepareRecipeChip
                  key={group.recipe_id}
                  recipe={{
                    recipe_id: group.recipe_id,
                    recipe_name: group.recipe_name,
                    recipe_emoji: group.recipe_emoji,
                    servings: basket.find(i => i.recipe_id === group.recipe_id)?.recipe_servings ?? 2,
                  }}
                  items={group.items}
                  lang={lang}
                  darkMode={darkMode}
                  onUpdateServings={onUpdateServings}
                  onRemoveRecipe={onRemoveRecipe}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyBasketState
          lang={lang}
          darkMode={darkMode}
          userId={userId}
          onManualAdd={onManualAdd}
          onAddToCart={onAddToCart}
          onShowRecipes={onShowRecipes}
          onOpenLists={() => setListsOpen(true)}
          onLoadList={onLoadList}
        />
      )}

      {/* Ajouter un article */}
      <button
        onClick={() => setAddSheetOpen(true)}
        className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 cursor-pointer font-bold text-[13px] w-full min-h-[44px]"
        style={{
          background: darkMode ? 'rgba(212,106,16,0.10)' : 'rgba(212,106,16,0.06)',
          border: '1.5px solid #D46A10',
          color: '#D46A10',
        }}
      >
        <LuPlus size={16} />
        {t.addItem}
      </button>

      {/* Actions secondaires */}
      <div className="flex gap-2">
        <button
          onClick={() => setSaveOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[11px] font-bold border cursor-pointer min-h-[44px]"
          style={{ background: cardBg, borderColor: cardBorder, color: muted }}
        >
          <LuSave size={14} />
          {t.save}
        </button>
        <button
          onClick={() => setListsOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[11px] font-bold border cursor-pointer min-h-[44px]"
          style={{ background: cardBg, borderColor: cardBorder, color: muted }}
        >
          <LuList size={14} />
          {t.myLists}
        </button>
        {hasContent && (
          <button
            onClick={async () => {
              if (await confirm({ title: t.clearConfirm, danger: true })) onClearBasket?.()
            }}
            className="flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 px-3 text-[11px] font-bold border cursor-pointer min-h-[44px]"
            style={{ background: cardBg, borderColor: 'rgba(220,38,38,0.3)', color: '#DC2626' }}
            aria-label={t.clearConfirm}
          >
            <LuEraser size={14} />
            {t.clear}
          </button>
        )}
      </div>

      {/* Budget estimé */}
      <CartBudgetBar
        total={budget}
        lang={lang}
        darkMode={darkMode}
        onShowSources={onShowSources}
      />

      {/* CTA → étape suivante */}
      {hasContent && onStartShopping && (
        <button
          onClick={onStartShopping}
          className="flex items-center justify-center gap-2 w-full rounded-[12px] py-4 text-[15px] font-extrabold border-none cursor-pointer min-h-[52px] transition-all"
          style={{
            background: 'var(--gradient-deep)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(212,106,16,0.30)',
          }}
        >
          {t.startShopping}
          <LuArrowRight size={18} />
        </button>
      )}

      {/* Bottom sheets / modales */}
      <AddItemSheet
        open={addSheetOpen}
        lang={lang}
        darkMode={darkMode}
        onClose={() => setAddSheetOpen(false)}
        onAddManualItem={onManualAdd}
        onAddToCart={onAddToCart}
        onShowRecipes={onShowRecipes}
        basket={basket}
        userId={userId}
      />

      {saveOpen && (
        <SaveShoppingListModal
          lang={lang}
          darkMode={darkMode}
          itemsCount={basket.length}
          isEmpty={basket.length === 0}
          onConfirm={(name) => { onSaveList?.(name); setSaveOpen(false) }}
          onClose={() => setSaveOpen(false)}
        />
      )}

      {listsOpen && (
        <ShoppingListsModal
          lang={lang}
          darkMode={darkMode}
          userId={userId}
          basketHasItems={basket.length > 0}
          onLoadList={(list) => { onLoadList?.(list); setListsOpen(false) }}
          onClose={() => setListsOpen(false)}
        />
      )}
    </div>
  )
}
