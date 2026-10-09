import GlobalOverlays from '@app/components/global-overlays'
import RecipeBrowserModals from '@app/components/recipe-browser-modals'
import BasketModalsRoot from '@app/components/basket-modals-root'
import AppModalsRoot from '@app/components/app-modals-root'
import FridgeOverlays from '@app/components/fridge-overlays'
import VoiceOverlays from '@app/components/voice-overlays'
import ReceiptScanOverlays from '@app/components/receipt-scan-overlays'

// Composant root unique pour tous les overlays top-level de l'app
// (modales, toasts, panneaux). Sprint 10 S10.a.25 — extrait depuis
// App.jsx pour réduire le bruit visuel du composant racine.
//
// Chaque sous-overlay reçoit ses props via un objet dédié (`*Props`)
// pour éviter d'avoir une signature à 100+ props plate. App.jsx
// construit ces objets et les passe ici en bloc.
//
// L'ordre de rendu respecte l'ordre original dans App.jsx :
//   1. GlobalOverlays      (UpdatePrompt, CookieBanner, Welcome, Upgrade)
//   2. RecipeBrowserModals (RecipeDeleteConfirmModal + RecipePanel)
//   3. BasketModalsRoot    (Cart + AddToFridge + UndoToasts)
//   4. AppModalsRoot       (Community + Admin + Support + WastePrevention + …)
//   5. FridgeOverlays      (Leftovers / Subcategory / SharedBasket)
//   6. VoiceOverlays       (5 surfaces voix)
//   7. ReceiptScanOverlays (scan de ticket de caisse)
//
// Sprint 11 S11.c.5 — RecipeOverlays SUPPRIMÉ. Les recettes ouvertes
// depuis la Communauté et le Journal cuisson naviguent vers la page
// pleine /recipe/:id (clic recette = changement de page).

export default function AppOverlays({
  globalOverlaysProps,
  recipeBrowserModalsProps,
  basketModalsRootProps,
  appModalsRootProps,
  fridgeOverlaysProps,
  voiceOverlaysProps,
  receiptScanOverlaysProps,
}) {
  return (
    <>
      <GlobalOverlays      {...globalOverlaysProps} />
      <RecipeBrowserModals {...recipeBrowserModalsProps} />
      <BasketModalsRoot    {...basketModalsRootProps} />
      <AppModalsRoot       {...appModalsRootProps} />
      <FridgeOverlays      {...fridgeOverlaysProps} />
      <VoiceOverlays       {...voiceOverlaysProps} />
      <ReceiptScanOverlays {...receiptScanOverlaysProps} />
    </>
  )
}
