import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/contexts/auth-provider'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useIngredientsById, useBaseRecipes, useGroupMaps } from '@shared/contexts/data-provider'
import { useStockSession, useFavoritesSession, useCartSession } from '@shared/contexts/session-state-context'
import { scoreRecipes } from '@shared/static/recipes'
import { useCartActions } from '@features/cart/hooks/use-cart-actions'
import { recordSpendingEvent } from '@shared/api/spending'
import { buildSpendingPayload } from '@features/cart/lib/spending-payload'
import { createShoppingList } from '@features/cart/api/shopping-lists'
import { UpgradeGate } from '@shared/ui/upgrade-gate'
import CartStepper from '@features/cart/components/cart-stepper'
import CartBackButton from '@features/cart/components/cart-back-button'
import PreparePhase from '@features/cart/components/prepare-phase'
import ShoppingPhase from '@features/cart/components/shopping-phase'
import HomePhase from '@features/cart/components/home-phase'
import WhatsNextPhase from '@features/cart/components/whats-next-phase'
import PricingSourcesModal from '@features/cart/components/pricing-sources-modal'
import { detectCartPhase } from '@features/cart/lib/cart-helpers'
import { useDocumentTitle } from '@shared/hooks/use-document-title'
import { titreDeRoute } from '@shared/lib/route-title'
import PageSkeleton from '@shared/ui/page-skeleton'

const I18N = {
  fr: { defaultListName: 'Courses' },
  en: { defaultListName: 'Groceries' },
}

// CartPage — page dédiée /cart, Premium-gated.
// Orchestrateur des 3 phases : Préparer → En courses → Rentré.
// Layout : colonne centrée max-width 680px, pas de sidebars.
// Reçoit uniquement lang + darkMode du routeur (pattern routes-config).
export default function CartPage({ lang = 'fr', darkMode = false }) {
  useDocumentTitle(titreDeRoute('/cart', lang))
  const t = I18N[lang] ?? I18N.fr
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPremiumAccess, profileLoading } = useSubscription()
  const ingredientsById = useIngredientsById()
  const { recipes: baseRecipes, recipeNames } = useBaseRecipes()
  const groupMaps = useGroupMaps()
  const { stock } = useStockSession()
  const { favorites, toggleFavorite } = useFavoritesSession()
  // Source unique : panier lifté en context (CartSession). Évite une
  // 2e instance useBasket désynchronisée du compteur header.
  const {
    basket,
    basketLoading,
    toggleItem,
    removeItem,
    removeRecipe,
    clear,
    refresh,
  } = useCartSession()

  const { handleManualAdd, handleLoadList, handleAddToCart, handleCompleteShopping, handleRemoveAllByIngredient, handleUpdateRecipeServings } = useCartActions({
    user,
    basket,
    // Sans `stock`, le filtre du hook ne retire plus rien et le panier se
    // remplit de ce qu'on possède déjà (défaut corrigé le 2026-08-28).
    stock,
    lang,
    ingredientsById,
    refreshBasket: refresh,
  })

  // ── Smart auto-détection ─────────────────────────────────────────────────
  const checkedItems = useMemo(() => basket.filter(i => i.checked), [basket])
  const autoPhase = detectCartPhase(basket, checkedItems.length)

  // manualPhase : phase choisie explicitement par l'utilisateur via le stepper.
  // Une fois posé, il prend le dessus sur l'auto-détection jusqu'à ce que
  // le panier soit vidé (basket.length === 0 → retour forcé à 'prepare').
  // Évite que cocher/décocher un article expulse l'utilisateur de son onglet.
  const [manualPhase, setManualPhase] = useState(null)
  // Snapshot de la dépense capturé au moment de l'ajout au frigo → alimente la
  // phase « Et après ? » (P4). `whatsNext` reste accessible même panier vidé.
  const [whatsNextSnapshot, setWhatsNextSnapshot] = useState(null)
  const activePhase = basket.length === 0 && manualPhase !== 'whatsNext'
    ? 'prepare'
    : (manualPhase ?? autoPhase)

  // Recettes faisables avec le stock courant (anti-gaspi) — calculées seulement
  // quand on est en phase « Et après ? ». scoreRecipes vient de shared (pas de
  // dépendance cross-feature).
  const feasibleRecipes = useMemo(
    () => (whatsNextSnapshot ? scoreRecipes(baseRecipes ?? [], stock, groupMaps) : []),
    [whatsNextSnapshot, baseRecipes, stock, groupMaps]
  )

  // Modale d'attribution des sources de prix (Eurostat CC-BY, clause prix
  // indicatifs). L'attribution complète est aussi dans les Mentions légales ;
  // ici c'est l'affordance « ℹ️ sources » près du budget estimé.
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const handlePhaseChange = (phase) => {
    if (phase === 'whatsNext' && !whatsNextSnapshot) return
    if (basket.length === 0 && phase !== 'prepare' && phase !== 'whatsNext') return
    setManualPhase(phase)
  }

  // Après l'ajout au frigo : capture le snapshot de la dépense (avant retrait des
  // cochés) puis route vers la phase « Et après ? » (suggestions post-courses).
  const handleCompleteShoppingAndReset = useCallback(async (basketArg) => {
    const checked = basketArg.filter(i => i.checked)
    const { total_eur, items_count, items_json } = buildSpendingPayload(checked)
    const totalSpent = total_eur
    const addedCount = new Set(checked.map(i => i.ingredient_id).filter(Boolean)).size
    // On garde les articles achetés pour permettre de sauvegarder la liste en P4
    // (le basket est vidé des cochés après l'ajout au frigo).
    const items = checked.map(i => ({
      ingredient_id: i.ingredient_id, label: i.label, amount: i.amount, unit: i.unit,
      price: i.price ?? null, recipe_id: i.recipe_id ?? null, recipe_name: i.recipe_name ?? null,
      recipe_emoji: i.recipe_emoji ?? null, checked: false,
      recipe_servings: i.recipe_servings ?? null, recipe_servings_initial: i.recipe_servings_initial ?? null,
      amount_initial: i.amount_initial ?? null,
    }))
    const result = await handleCompleteShopping(basketArg)
    if (!result?.error) {
      // Capture l'événement dépense pour l'analyse « Mes dépenses » (Premium).
      // Indispensable ici : la route /cart complète les courses via
      // handleCompleteShopping (qui ne persiste rien), contrairement à
      // l'ancien flux popover (handleConfirmAddToFridge). Sans cet appel,
      // spending_events restait toujours vide → dashboard jamais alimenté.
      // Le gate RGPD (opt-out profilage) est géré dans recordSpendingEvent.
      // Non bloquant : un échec de capture ne doit pas casser le parcours.
      if (user?.id && items_count > 0) {
        try {
          await recordSpendingEvent(user.id, { total_eur, items_count, items_json })
        } catch { /* capture best-effort, ne bloque pas le flux */ }
      }
      setWhatsNextSnapshot({ totalSpent, addedCount, items })
      setManualPhase('whatsNext')
    }
    return result
  }, [handleCompleteShopping, user])

  const donePhases = useMemo(() => {
    const s = new Set()
    if (basket.length > 0 && checkedItems.length > 0) s.add('prepare')
    if (checkedItems.length >= basket.length && basket.length > 0) s.add('shopping')
    return s
  }, [basket, checkedItems])

  const handleSaveList = useCallback(async (name) => {
    if (!user?.id || basket.length === 0) return
    const items = basket.map(i => ({
      ingredient_id: i.ingredient_id,
      label: i.label,
      amount: i.amount,
      unit: i.unit,
      price: i.price ?? null,
      recipe_id: i.recipe_id ?? null,
      recipe_name: i.recipe_name ?? null,
      recipe_emoji: i.recipe_emoji ?? null,
      checked: i.checked ?? false,
      recipe_servings: i.recipe_servings ?? null,
      recipe_servings_initial: i.recipe_servings_initial ?? null,
      amount_initial: i.amount_initial ?? null,
    }))
    await createShoppingList(user.id, name, items)
  }, [user, basket])

  const handleShowRecipes = useCallback(() => navigate('/'), [navigate])

  // ── Paywall inline ───────────────────────────────────────────────────────
  // Le profil arrive après `loading` : sans cette attente, un abonné voyait le
  // verrou un instant à chaque ouverture (audit du 2026-10-04, PREM-06).
  if (profileLoading) return <PageSkeleton lang={lang} darkMode={darkMode} />

  if (!hasPremiumAccess) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center p-6"
        style={{ background: darkMode ? '#0B1420' : '#F5EDE0' }}
      >
        {/* Le titre de la page, ici aussi (audit A11Y-19 : sans Premium, la
            page n'en avait aucun — `page-has-heading-one`). */}
        <h1 className="sr-only">{titreDeRoute('/cart', lang).replace(' — Fridge+', '')}</h1>
        <div className="w-full max-w-sm">
          <UpgradeGate feature="basket" variant="hard" lang={lang} darkMode={darkMode} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh"
      style={{ background: darkMode ? '#0B1420' : '#F5EDE0' }}
    >
      {/* Le stepper fait office de titre visuel ; la page n'avait donc aucun
          titre pour un lecteur d'écran. `sr-only` : la sémantique est
          corrigée sans toucher au design. */}
      <h1 className="sr-only">{titreDeRoute('/cart', lang).replace(' — Fridge+', '')}</h1>
      <CartStepper
        activePhase={activePhase}
        donePhases={donePhases}
        onPhaseChange={handlePhaseChange}
        basketEmpty={basket.length === 0}
        whatsNextAvailable={!!whatsNextSnapshot}
        lang={lang}
        darkMode={darkMode}
      />

      {/* Spacer : compense le CartStepper fixed (sorti du flux — top 85/93px + hauteur 65px − pt-24 96px) */}
      <div aria-hidden="true" className="h-[54px] lg:h-[62px]" />

      {/* Colonne unique centrée — 680px max */}
      <div className="max-w-[680px] mx-auto px-4 py-4">
        {basketLoading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#D46A10', borderTopColor: 'transparent' }}
            />
          </div>
        ) : (
          <>
            <CartBackButton activePhase={activePhase} onPhaseChange={handlePhaseChange} lang={lang} darkMode={darkMode} />
            {activePhase === 'prepare' && (
              <PreparePhase
                basket={basket}
                lang={lang}
                darkMode={darkMode}
                userId={user?.id}
                ingredientsById={ingredientsById}
                onUpdateServings={handleUpdateRecipeServings}
                onRemoveItem={removeItem}
                onRemoveRecipe={removeRecipe}
                onClearBasket={clear}
                onSaveList={handleSaveList}
                onLoadList={handleLoadList}
                onManualAdd={handleManualAdd}
                onAddToCart={handleAddToCart}
                onShowRecipes={handleShowRecipes}
                onShowSources={() => setSourcesOpen(true)}
                onRemoveAllByIngredient={handleRemoveAllByIngredient}
                onStartShopping={() => handlePhaseChange('shopping')}
              />
            )}
            {activePhase === 'shopping' && (
              <ShoppingPhase
                basket={basket}
                lang={lang}
                darkMode={darkMode}
                userId={user?.id}
                ingredientsById={ingredientsById}
                onToggleItem={toggleItem}
                onGoToHome={() => handlePhaseChange('home')}
                onSaveList={handleSaveList}
              />
            )}
            {activePhase === 'home' && (
              <HomePhase
                basket={basket}
                lang={lang}
                darkMode={darkMode}
                onCompleteShopping={handleCompleteShoppingAndReset}
                onClearBasket={clear}
              />
            )}
            {activePhase === 'whatsNext' && (
              <WhatsNextPhase
                snapshot={whatsNextSnapshot}
                recipes={feasibleRecipes}
                lang={lang}
                darkMode={darkMode}
                favorites={favorites}
                recipeNames={recipeNames}
                onToggleFavorite={toggleFavorite}
                onShowRecipe={(r) => navigate(`/recipe/${r.id}`)}
                onShowAllRecipes={handleShowRecipes}
                onSaveList={() => {
                  if (!user?.id || !whatsNextSnapshot?.items?.length) return
                  const name = `${t.defaultListName} ${new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}`
                  createShoppingList(user.id, name, whatsNextSnapshot.items)
                }}
                onStartNewBasket={() => { setWhatsNextSnapshot(null); setManualPhase('prepare') }}
                onBackToFridge={() => navigate('/')}
              />
            )}
          </>
        )}
      </div>

      {sourcesOpen && (
        <PricingSourcesModal
          lang={lang}
          darkMode={darkMode}
          onClose={() => setSourcesOpen(false)}
        />
      )}
    </div>
  )
}
