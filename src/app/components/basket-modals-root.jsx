import { Suspense, lazy } from 'react'
import BasketUndoToasts from '@app/components/basket-undo-toasts'

const AddToFridgeModal = lazy(() => import('@features/cart/components/add-to-fridge-modal'))

// Composant orchestrant les surfaces top-level liées au panier :
// la modale de transfert panier → frigo (AddToFridgeModal) et les
// 2 toasts d'annulation (BasketUndoToasts). ShoppingCartPanel retiré
// (v3.420.0) — remplacé par la route /cart (CartPage).
//
// AddToFridgeModal exige auth (user non nul).
// BasketUndoToasts est toujours rendu (composant gère lui-même son
// affichage selon les toasts non-nuls).

export default function BasketModalsRoot({
  // basket data
  basket,
  loadedListInfo,
  // add-to-fridge modal
  addToFridgeOpen,
  onAddToFridgeClose,
  onConfirmAddToFridge,
  // undo toasts
  clearBasketToast,
  fridgeToast,
  onRestoreClearedBasket,
  onFridgeUndo,
  // auth
  user,
  // i18n / theme
  lang,
  darkMode,
  // remaining props from App.jsx are intentionally not destructured
  // (ShoppingCartPanel was removed; they remain in basketModalsRootProps
  // for backward compat and will be cleaned in a dedicated chore PR)
}) {
  return (
    <>
      {addToFridgeOpen && user && (
        <Suspense fallback={null}>
          <AddToFridgeModal
            basket={basket}
            lang={lang}
            darkMode={darkMode}
            onClose={onAddToFridgeClose}
            onConfirm={onConfirmAddToFridge}
            loadedListInfo={loadedListInfo}
            userId={user?.id}
          />
        </Suspense>
      )}

      <BasketUndoToasts
        clearBasketToast={clearBasketToast}
        fridgeToast={fridgeToast}
        onRestoreClearedBasket={onRestoreClearedBasket}
        onFridgeUndo={onFridgeUndo}
        lang={lang}
        darkMode={darkMode}
      />
    </>
  )
}
