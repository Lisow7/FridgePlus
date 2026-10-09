import { useState, useRef, useCallback } from 'react'
import { addBasketItems, clearBasket, removeBasketItem } from '@features/cart/api/basket'
import { categorizeIngredientsByStorage } from '@features/fridge/lib/categorize-ingredients'
import { recordSpendingEvent, deleteSpendingEvent } from '@shared/api/spending'
// ⛔ PAS d'import statique de `pack-optimizer` ici : il tire
// `pricing-resolver`, qui embarque le JSON des prix 2026 — 171,7 ko de
// parse/eval et 16,7 ko gzip DANS LE GRAPHE INITIAL, pour un seul appel de
// repli (item sans `price`, ajout manuel/legacy) qui ne survient jamais au
// chargement. Mesuré le 2026-08-25 : ce fichier était l'UNIQUE chemin qui
// l'amenait au boot. L'import est dynamique, au site d'appel (déjà async).

// Hook orchestrant les deux flux destructifs du panier munis d'un toast
// d'annulation : « vider le panier » (clearBasket) et « j'ai fait mes
// courses » (panier → frigo). Sprint 10 S10.a.7 — extrait depuis App.jsx.
//
// Les deux toasts sont volontairement mutuellement exclusifs : déclencher
// l'un annule l'autre (priorité au plus récent), d'où la cohabitation
// dans un même hook.
//
// Renvoie :
//   - clearBasketToast            : null | { items: [...] }
//   - fridgeToast                 : null | { count, nFridge, nPantry,
//                                            addedIds, removedItems,
//                                            spendingEventId }
//   - handleClearBasket           : vide le panier (snapshot pour undo)
//   - handleRestoreClearedBasket  : annule le clearBasket
//   - handleConfirmAddToFridge    : transfère panier → frigo + snapshot
//   - handleFridgeUndo            : annule le transfert (réajoute panier)
//
// Dépendances injectées : user, lang, stock, basket + setters/refresh
// du hook useBasket, addStockBatch/removeStockBatch du hook
// useFridgeStock, setLoadedListInfo (state local App.jsx),
// modals.addToFridge (useAppModals).

export function useBasketToasts({
  user,
  lang,
  stock,
  basket,
  setBasket,
  refreshBasket,
  addStockBatch,
  removeStockBatch,
  setLoadedListInfo,
  modals,
}) {
  // Snapshot du panier avant suppression — sert au toast d'annulation pour
  // restaurer toute la liste si l'utilisateur a cliqué la poubelle par erreur.
  const [clearBasketToast, setClearBasketToast] = useState(null)
  const clearBasketTimerRef = useRef(null)

  // « J'ai fait mes courses » : transfert panier → frigo.
  // Toast d'annulation après confirmation. Snapshot des IDs ajoutés au stock
  // et des items panier retirés, pour pouvoir restaurer si l'utilisateur
  // clique « Annuler » dans les 7 secondes.
  const [fridgeToast, setFridgeToast] = useState(null)
  const fridgeToastTimerRef = useRef(null)

  const handleClearBasket = useCallback(async () => {
    if (!user?.id || basket.length === 0) return
    const snapshot = [...basket]
    const { error } = await clearBasket(user.id)
    if (error) return
    // Refetch sync pour aligner l'UI sur la BDD réelle.
    await refreshBasket()
    // On quitte le contexte « édition d'une liste » : reset du nom
    setLoadedListInfo(null)
    // Annule un toast d'ajout au frigo en cours (priorité au plus récent)
    if (fridgeToastTimerRef.current) clearTimeout(fridgeToastTimerRef.current)
    setFridgeToast(null)
    // Toast d'annulation 3s — moins intrusif après l'action de vidage
    // qui est rarement annulée.
    if (clearBasketTimerRef.current) clearTimeout(clearBasketTimerRef.current)
    setClearBasketToast({ items: snapshot })
    clearBasketTimerRef.current = setTimeout(() => setClearBasketToast(null), 3000)
  }, [user?.id, basket, refreshBasket, setLoadedListInfo])

  const handleRestoreClearedBasket = useCallback(async () => {
    if (!clearBasketToast || !user?.id) return
    const { items } = clearBasketToast
    // Strip les `id` du snapshot avant l'INSERT : les rows BDD d'origine
    // ont été deleted, leurs uuid ne doivent pas être réinjectés
    // (Supabase générera de nouveaux uuid). Strip aussi `added_at` pour
    // laisser le default `now()` reprendre.
    const cleanItems = items.map(({ id: _id, added_at: _addedAt, ...rest }) => rest)
    const { error } = await addBasketItems(user.id, cleanItems)
    if (error) {
      if (import.meta.env.DEV) console.error('[basket] restore failed:', error)
      return
    }
    await refreshBasket()
    if (clearBasketTimerRef.current) clearTimeout(clearBasketTimerRef.current)
    setClearBasketToast(null)
  }, [clearBasketToast, user?.id, refreshBasket])

  const handleConfirmAddToFridge = useCallback(async ({ ingredientIds, removedItems }) => {
    if (!user?.id || ingredientIds.length === 0) return

    // Dédup défensive : si plusieurs items du panier ont le même
    // ingredient_id, ne l'ajouter qu'une fois au stock.
    const uniqueIds = [...new Set(ingredientIds)]
    const trulyNewIds = uniqueIds.filter(id => !stock.has(id))
    const { fridge: nFridge, pantry: nPantry } = categorizeIngredientsByStorage(trulyNewIds)

    // 1. Ajout au stock (mémoire + DB) — délégué au hook useFridgeStock.
    addStockBatch(trulyNewIds)

    // 2. Retrait du panier (mémoire + DB)
    const removedIds = new Set(removedItems.map(it => it.id).filter(Boolean))
    if (removedIds.size > 0) {
      for (const item of removedItems) {
        if (item.id) removeBasketItem(item.id)
      }
      setBasket(prev => prev.filter(i => !removedIds.has(i.id)))
    }

    // 3. Fermeture du modal + toast d'annulation
    modals.addToFridge.close()
    // Annule un toast de clear basket en cours (priorité au plus récent)
    if (clearBasketTimerRef.current) clearTimeout(clearBasketTimerRef.current)
    setClearBasketToast(null)

    // Snapshot dépense (analyse Premium). Non-bloquant.
    // v3.411 — bug fix : utilise item.price stocké en BDD (calculé via
    // getEmbeddedPrice au moment de l'ajout au panier, cf. use-basket-actions
    // handleAddToCart) au lieu de recompute via optimizePackPurchase qui :
    //   1. utilisait item.qty (n'existe pas — la colonne s'appelle 'amount')
    //   2. retournait null si l'ingredient n'était pas dans PACK_SIZES
    // → tous les spending_events étaient persistés avec total_eur=0 alors
    // que le user avait fait plusieurs courses (8 events pour Lisow tous à 0€).
    // Fallback optimizePackPurchase si item.price absent (cas legacy / manuel
    // add via barre de recherche du panier sans recette).
    let spendingEventId = null
    if (removedItems.length > 0) {
      try {
        let total = 0
        const itemsJson = []
        // Chargé une seule fois si au moins un article n'a pas de prix — le
        // module est ensuite en cache navigateur pour la session.
        const sansPrix = removedItems.some(it => it?.id && !Number(it.price ?? 0))
        const optimiseur = sansPrix
          ? (await import('@features/cart/lib/pack-optimizer')).optimizePackPurchase
          : null
        for (const item of removedItems) {
          if (!item?.id) continue
          let priceEur = Number(item.price ?? 0)
          if (!priceEur && optimiseur) {
            const opt = optimiseur(item.ingredient_id ?? item.id, item.amount ?? 0, item.unit ?? 'pcs', lang)
            priceEur = opt?.totalPrice ? Number(opt.totalPrice) : 0
          }
          total += priceEur
          itemsJson.push({
            id: item.ingredient_id ?? item.id,
            qty: item.amount ?? 0,
            unit: item.unit ?? 'pcs',
            unit_eur: priceEur,
          })
        }
        const result = await recordSpendingEvent(user.id, {
          total_eur: Math.round(total * 100) / 100,
          items_count: itemsJson.length,
          items_json: itemsJson,
        })
        if (result.ok) spendingEventId = result.id
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[spending] capture failed', e)
      }
    }
    if (fridgeToastTimerRef.current) clearTimeout(fridgeToastTimerRef.current)
    setFridgeToast({
      count: trulyNewIds.length,
      nFridge, nPantry,
      addedIds: trulyNewIds,
      removedItems,
      spendingEventId,
    })
    fridgeToastTimerRef.current = setTimeout(() => setFridgeToast(null), 7000)
  }, [user, stock, lang, addStockBatch, setBasket, modals])

  const handleFridgeUndo = useCallback(() => {
    if (!fridgeToast) return
    const { addedIds, removedItems, spendingEventId } = fridgeToast
    if (spendingEventId) {
      deleteSpendingEvent(spendingEventId).catch(() => {})
    }
    removeStockBatch(addedIds)
    if (removedItems?.length > 0 && user?.id) {
      addBasketItems(user.id, removedItems).then(() => refreshBasket())
    }
    if (fridgeToastTimerRef.current) clearTimeout(fridgeToastTimerRef.current)
    setFridgeToast(null)
  }, [fridgeToast, user, removeStockBatch, refreshBasket])

  return {
    clearBasketToast,
    fridgeToast,
    handleClearBasket,
    handleRestoreClearedBasket,
    handleConfirmAddToFridge,
    handleFridgeUndo,
  }
}
