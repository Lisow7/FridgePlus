import { useEffect, useCallback, useRef } from 'react'
import { loadStockFromDB } from '@features/fridge/api/stock'
import { loadFavoritesFromDB } from '@features/recipes/api/favorites'
import { getCustomRecipes } from '@features/recipes/lib/custom-recipes'
import { migrateLocalStorageToDB } from '@shared/lib/migration'

// Hook orchestrant le cycle de vie d'une session utilisateur :
// chargement des données user-dépendantes au login + reset complet
// au logout (state + localStorage + modales). Sprint 10 S10.a.10 —
// extrait depuis App.jsx.
//
// Renvoie :
//   - handleSignOut : ferme toutes les modales user-dépendantes,
//                     reset state + localStorage, puis appelle signOut().
//
// Effet interne :
//   - useEffect [user?.id] : à chaque changement d'utilisateur, soit
//     reset (déconnexion silencieuse, expiration token, signOut autre
//     onglet) soit load des données BDD (stock + favorites + recettes
//     custom + migration localStorage one-shot).
//
// Sans le reset explicite, une expiration silencieuse de session
// laissait stock/favorites/customRecipes peuplés avec les données du
// précédent user → l'UI restait dans un état « connecté en façade »
// jusqu'à un F5 manuel. Les autres états user-dépendants (basket,
// leftovers, supportUnread, allergenPrefs) sont reset par leurs
// propres useEffect dans leurs hooks respectifs.
//
// Dépendances injectées : user, signOut (auth), setters state local
// App.jsx (stock/favorites/custom recipes/deletingRecipe/activeSubcat/
// showRecipes), modals (useAppModals).
//
// Sprint 11 S11.c.5 — setJournalRecipe retiré : journalRecipe state
// supprimé d'App.jsx (le Journal cuisine ouvre maintenant les recettes
// via navigate('/recipe/:id', state.background) — cf. S11.c.4).

export function useUserSession({
  user,
  signOut,
  setStock,
  setStockMeta,
  setFavorites,
  setCustomRecipes,
  setDeletingRecipe,
  setActiveSubcat,
  setShowRecipes,
  modals,
}) {
  // Suit l'uid précédent pour distinguer un PUR invité (jamais connecté) d'une
  // transition connecté→null (logout / expiration silencieuse de token).
  const prevUserIdRef = useRef(undefined)

  useEffect(() => {
    if (!user) {
      // Reset SEULEMENT si on était connecté avant (logout/expiration) → on purge
      // les données de l'ex-user. Pour un PUR invité, NE PAS toucher : son
      // stock/favoris viennent du localStorage (chargés par les hooks) et doivent
      // PERSISTER au reload (sinon un invité de retour perd tout). [fix invité]
      if (prevUserIdRef.current != null) {
        setStock(new Set())
        setStockMeta(new Map())
        setFavorites(new Set())
        setCustomRecipes([])
      }
      prevUserIdRef.current = undefined
      return
    }
    prevUserIdRef.current = user.id

    // 🔴 Jeton d'annulation (2026-08-28, audit). Sans lui, se déconnecter de A
    // puis se connecter à B pendant qu'une requête de A est encore en vol
    // faisait ÉCRASER l'état de B par la réponse tardive de A : B voyait le
    // frigo et les favoris de A. La fenêtre couvre la migration (jusqu'à 4
    // requêtes) plus 3 chargements parallèles — étroite, mais réelle sur
    // réseau lent, et c'est une fuite entre comptes.
    // 🥇 Même patron que `use-basket.js` (versionRef + isLatestToken).
    const idDemande = user.id
    let annule = false

    async function loadUserData() {
      await migrateLocalStorageToDB(idDemande)
      const [stockResult, favResult, recipes] = await Promise.all([
        loadStockFromDB(idDemande),
        loadFavoritesFromDB(idDemande),
        getCustomRecipes(idDemande),
      ])
      // L'utilisateur a changé (ou le composant est démonté) pendant le vol :
      // cette réponse ne concerne plus l'écran affiché.
      if (annule || prevUserIdRef.current !== idDemande) return

      // 🔴 Un chargement en échec ne doit PAS écraser l'état par du vide : le
      // Set vide d'une erreur réseau était indistinguable d'un frigo vide, et
      // il armait la suppression (cf. `clearStock`). On conserve l'existant.
      if (!stockResult.error) {
        setStock(stockResult.stock)
        setStockMeta(stockResult.meta)
      }
      if (!favResult.error) setFavorites(favResult.favorites)
      setCustomRecipes(recipes)
    }
    loadUserData()
    return () => { annule = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = useCallback(async () => {
    localStorage.removeItem('fridge-stock')
    localStorage.removeItem('fridge-favorites')
    localStorage.removeItem('fridge-custom-recipes')
    setStock(new Set())
    setStockMeta(new Map())
    setFavorites(new Set())
    setCustomRecipes([])
    // Ferme toutes les modales et panels user-dépendants au logout :
    // sinon une modale ouverte (AdminPanel, SupportPanel…) reste
    // affichée mais avec des données vides ou d'un autre user —
    // rendant l'UI incohérente jusqu'à un F5.
    //
    // Sprint 11 S11.a.6 — modals.profile retiré : Profile est désormais
    // une route /profile gated par AuthGuard, qui redirige automatiquement
    // vers / dès que le user est null (pas besoin de close manuel).
    // Sprint 11 S11.b.5 — modals.auth retiré : auth est désormais routée
    // (/login, /signup, /auth/recovery). Pas de close manuel non plus.
    // Sprint 11 S11.d — modals.community retiré (Communauté est une
    // route /community désormais, AuthGuard pas requis car le feed est
    // accessible aux invités).
    modals.admin.close()
    modals.support.close()
    modals.cart.close()
    setShowRecipes(false)
    setDeletingRecipe(null)
    setActiveSubcat(null)
    await signOut()
  }, [signOut, setStock, setStockMeta, setFavorites, setCustomRecipes, setShowRecipes, setDeletingRecipe, setActiveSubcat, modals])

  return { handleSignOut }
}
