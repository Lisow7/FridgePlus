import { useCallback } from 'react'

// Hook regroupant les 3 handlers de navigation top-level d'App.jsx :
// ouverture d'un compartiment frigo, dispatch d'une notification, et
// reset complet (« retour accueil »). Sprint 10 S10.a.12 — extrait
// depuis App.jsx.
//
// Renvoie :
//   - handleSubcategoryClick  : ouvre un compartiment frigo / pantry
//   - handleNotificationClick : dispatch selon le type de notif
//                                (ticket_reply, recipe_approved,
//                                 recipe_rejected, recipe_promoted)
//   - handleReset             : « retour accueil » — navigate('/') +
//                                fermeture exhaustive (doors, panels,
//                                modales, mobileTab → fridge)
//
// La logique d'auto mark-read et de fermeture du panel notifications
// est faite côté NotificationsPanel ; ici on s'occupe juste de la
// navigation. Pour `recipe_*`, on navigate vers /recipe/:id (page
// pleine). Si la recette a été supprimée entre-temps, no-op silencieux :
// la notif disparaîtra à son `expires_at` (pas de toast d'erreur, l'UX
// reste fluide). Si l'user n'est pas le propriétaire d'une recette
// privée, RecipePage affichera son écran « Recette introuvable » (cf.
// useRecipeById qui renvoie 'not-found' sans distinguer inexistante vs
// privée — pas de leak RGPD).
//
// Dépendances injectées : modals, setters state local, closeAllDoors,
// navigate (react-router).

export function useAppNavigation({
  modals,
  setActiveSubcat,
  setShowRecipes,
  setMobileTab,
  closeAllDoors,
  navigate,
}) {
  const handleSubcategoryClick = useCallback((compartment, sub) => {
    setActiveSubcat({ compartment, sub })
  }, [setActiveSubcat])

  const handleNotificationClick = useCallback((notif) => {
    if (notif.type === 'ticket_reply') {
      modals.support.open()
      return
    }
    if (notif.type === 'recipe_approved' || notif.type === 'recipe_rejected' || notif.type === 'recipe_promoted') {
      const recipeId = notif.metadata?.recipe_id
      if (!recipeId) return
      // Navigation vers la page recette (page pleine). La résolution
      // custom/public est faite par useRecipeById (fetch Supabase en
      // cold-load via deep-link).
      navigate(`/recipe/${recipeId}`)
    }
    // Alerte péremption → ouvre le panneau Recettes (l'utilisateur peut y
    // appliquer le filtre « zéro déchet »). Le tri « cuisiner d'abord » a été
    // retiré ; ces alertes seront revisitées au chantier DLC/restes.
    if (notif.type === 'stock_expiring_soon' || notif.type === 'stock_expiring_today') {
      setShowRecipes(true)
    }
  }, [modals, navigate, setShowRecipes])

  const handleReset = useCallback(() => {
    navigate('/')
    closeAllDoors()
    setActiveSubcat(null)
    setShowRecipes(false)
    modals.cart.close()
    modals.support.close()
    modals.admin.close()
    // Sprint 11 S11.a.6 — modals.profile retiré : Profile est désormais
    // une route /profile. Le `navigate('/')` ci-dessus (handleReset) suffit.
    // Sprint 11 S11.b.5 — modals.auth retiré : auth est désormais routée
    // (/login, /signup, /auth/recovery). Idem, `navigate('/')` suffit.
    // Sprint 11 S11.d — modals.community retiré : Communauté est une
    // route /community désormais. Idem, `navigate('/')` suffit.
    setMobileTab('fridge')
  }, [navigate, closeAllDoors, setActiveSubcat, setShowRecipes, modals, setMobileTab])

  return {
    handleSubcategoryClick,
    handleNotificationClick,
    handleReset,
  }
}
