import { Suspense, lazy } from 'react'
import { useIngredients } from '@shared/contexts/data-provider'

const LeftoversModal   = lazy(() => import('@features/fridge/components/leftovers-modal'))
const SubcategoryModal = lazy(() => import('@shared/ui/subcategory-modal'))
const SharedBasketPage = lazy(() => import('@features/cart/components/shared-basket-page'))

// Composant orchestrant les 3 overlays liés au frigo et au panier
// partagé : modale Restes (today/thisweek), modale Sous-catégorie
// (un compartiment frigo / garde-manger), et la page Panier Partagé
// (lien public ?shared=<uuid>). Sprint 10 S10.a.17 — extrait depuis
// App.jsx (~50 lignes).
//
// `activeSubcat` peut être null OU un objet { compartment, sub }.
// Le routing entre LeftoversModal et SubcategoryModal se fait sur
// `activeSubcat.sub.id` : 'today' / 'thisweek' → LeftoversModal,
// tout autre id → SubcategoryModal qui affiche les ingrédients de
// la sous-catégorie correspondante.

export default function FridgeOverlays({
  activeSubcat,
  setActiveSubcat,
  sharedBasketId,
  setSharedBasketId,
  // shared data
  stock,
  leftovers,
  savedCount,
  customRecipes,
  publicRecipes,
  allergenPrefs,
  // actions
  toggleIngredient,
  onAddLeftover,
  onDeleteLeftover,
  // auth gating (LeftoversModal needs to prompt unauthenticated users)
  user,
  onShowAuth,
  // i18n / theme
  lang,
  darkMode,
}) {
  const INGREDIENTS = useIngredients()
  const isLeftoversView = activeSubcat && (activeSubcat.sub.id === 'today' || activeSubcat.sub.id === 'thisweek')
  const isSubcategoryView = activeSubcat && !isLeftoversView

  return (
    <>
      {isLeftoversView && (
        <Suspense fallback={null}>
          <LeftoversModal
            view={activeSubcat.sub.id}
            leftovers={leftovers}
            savedCount={savedCount}
            stock={stock}
            customRecipes={customRecipes}
            publicRecipes={publicRecipes}
            onAdd={onAddLeftover}
            onDelete={onDeleteLeftover}
            lang={lang}
            darkMode={darkMode}
            onClose={() => setActiveSubcat(null)}
            user={user}
            onShowAuth={onShowAuth}
          />
        </Suspense>
      )}

      {isSubcategoryView && (
        <Suspense fallback={null}>
          <SubcategoryModal
            compartment={activeSubcat.compartment}
            subcategory={activeSubcat.sub}
            ingredients={INGREDIENTS[activeSubcat.sub.id] ?? []}
            stock={stock}
            onToggle={toggleIngredient}
            onClose={() => setActiveSubcat(null)}
            lang={lang}
            darkMode={darkMode}
            allergenPrefs={allergenPrefs}
          />
        </Suspense>
      )}

      {/* v3.127.0 — Panier partagé public (?shared=<uuid>) — page pleine */}
      {sharedBasketId && (
        <Suspense fallback={null}>
          <SharedBasketPage
            sharedId={sharedBasketId}
            lang={lang}
            darkMode={darkMode}
            onClose={() => setSharedBasketId(null)}
          />
        </Suspense>
      )}
    </>
  )
}
