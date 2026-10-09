import { useState, useCallback, useRef } from 'react'
import { addToStock, removeFromStock, clearStock } from '@features/fridge/api/stock'
import { track } from '@shared/lib/observability/track'

// Sprint 6 PR S6.d — Custom hook `useFridgeStock`.
// Anti-gaspi 1A — ajoute `stockMeta` (fraîcheur) EN PARALLÈLE du `Set`.
//
// Le `Set<id>` reste la source « présent/absent » (consommateurs inchangés).
// `stockMeta: Map<id, {addedAt, expiresAt}>` porte la fraîcheur. Persistance
// hybride : connecté → DB (api stock.js, added_at via défaut BDD) ; invité →
// localStorage 'fridge-stock' au nouveau format `[{id, addedAt, expiresAt}]`
// (l'ancien format `['id']` est migré en lecture).
//
// API : { stock, stockMeta, setStock, setStockMeta, toggleIngredient,
//         resetStock, emptyFridgeOptimistic, emptyFridgeConfirm,
//         emptyFridgeUndo, addBatch, removeBatch, setExpiry }

const LOCALSTORAGE_KEY = 'fridge-stock'
const nowIso = () => new Date().toISOString()

// Lit le localStorage en gérant l'ancien format (strings) ET le nouveau (objets).
function loadInitial() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) ?? '[]')
    const set = new Set(); const meta = new Map()
    if (Array.isArray(arr)) {
      for (const e of arr) {
        if (typeof e === 'string') { set.add(e); meta.set(e, { addedAt: nowIso(), expiresAt: null }) }
        else if (e && e.id) { set.add(e.id); meta.set(e.id, { addedAt: e.addedAt ?? nowIso(), expiresAt: e.expiresAt ?? null }) }
      }
    }
    return { set, meta }
  } catch {
    return { set: new Set(), meta: new Map() }
  }
}

function persistLocalStorage(set, meta) {
  try {
    const arr = [...set].map(id => {
      const m = meta.get(id) ?? { addedAt: nowIso(), expiresAt: null }
      return { id, addedAt: m.addedAt, expiresAt: m.expiresAt ?? null }
    })
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(arr))
  } catch {
    // localStorage indisponible — silent
  }
}

export function useFridgeStock(user, { onRemoved } = {}) {
  // Single init (reviewer) : un seul loadInitial → stock et meta cohérents,
  // pas deux lectures localStorage ni deux `now()` divergents.
  const initialRef = useRef(null)
  if (initialRef.current === null) initialRef.current = loadInitial()
  const [stock, setStock]         = useState(() => initialRef.current.set)
  const [stockMeta, setStockMeta] = useState(() => initialRef.current.meta)

  // Refs synchronisés au state courant — permettent d'émettre `onRemoved`
  // (anti-gaspi 1B-i) AVANT mutation, hors des updaters setState (pas de
  // double-fire en StrictMode, pas de stale closure).
  const stockRef = useRef(stock); stockRef.current = stock
  const metaRef = useRef(stockMeta); metaRef.current = stockMeta
  const onRemovedRef = useRef(onRemoved); onRemovedRef.current = onRemoved

  // Projection du prochain état, pour tout ce qui doit s'exécuter HORS des
  // updaters : appels DB, écriture localStorage, events anti-gaspi.
  //
  // Les refs seules ne suffisent pas : elles ne se resynchronisent qu'au
  // rendu. Deux mutations groupées dans un même tick y liraient le même état
  // commité — les updaters composeraient bien (ils partent de `prev`), mais
  // les effets de bord se marcheraient dessus, la seconde écriture
  // localStorage écrasant la première. L'invité perdait alors un ingrédient
  // au rechargement (constaté par test le 2026-08-28).
  //
  // `projection()` rend l'état cumulé du tick : elle repart de l'état commité
  // dès que celui-ci change d'identité — donc après chaque rendu — et
  // s'accumule sinon.
  //
  // ⚠️ Le test d'identité NE SUFFIT PAS pour les chemins qui REMPLACENT le
  // stock : dans le même tick, `stockRef` n'a pas encore bougé, la projection
  // se croit à jour et repart de l'état d'avant. Un vidage optimiste suivi d'un
  // ajout ressuscitait ainsi tout le frigo dans le localStorage de l'invité.
  // Chacun de ces chemins POSE donc sa projection via `poserProjection`.
  //
  // ⚠️ Limite assumée : `setStock`/`setStockMeta` sont aussi exportés bruts pour
  // l'orchestration (migration, connexion). Ces appels-là ne posent pas de
  // projection — elle se resème au rendu suivant. C'est sans conséquence tant
  // qu'aucune mutation ne les suit DANS LE MÊME TICK, ce qui n'arrive pas :
  // l'orchestration remplace l'état puis rend la main.
  const projRef = useRef(null)
  const projection = () => {
    const courante = projRef.current
    if (courante && courante.base === stockRef.current) return courante
    const fraiche = { base: stockRef.current, set: new Set(stockRef.current), meta: new Map(metaRef.current) }
    projRef.current = fraiche
    return fraiche
  }
  const poserProjection = (set, meta) => {
    projRef.current = { base: stockRef.current, set: new Set(set), meta: new Map(meta) }
  }
  const persistGuest = (proj) => persistLocalStorage(proj.set, proj.meta)

  const emitRemoved = (ids, proj) => {
    const fn = onRemovedRef.current
    if (!fn) return
    const removed = ids
      .filter(id => proj.set.has(id))
      .map(id => ({ id, meta: proj.meta.get(id) ?? null }))
    if (removed.length) fn(removed)
  }

  const toggleIngredient = useCallback((id) => {
    const proj = projection()
    const wasPresent = proj.set.has(id)
    if (wasPresent) emitRemoved([id], proj) // retrait → event anti-gaspi
    else track('ingredient_added', { ingredientId: id })

    // Horodatage figé hors updater : `nowIso()` dedans rendait l'updater
    // non déterministe (deux invocations, deux dates).
    const stamp = nowIso()
    if (wasPresent) { proj.set.delete(id); proj.meta.delete(id) }
    else { proj.set.add(id); if (!proj.meta.has(id)) proj.meta.set(id, { addedAt: stamp, expiresAt: null }) }
    setStock(prevSet => {
      const nextSet = new Set(prevSet)
      if (wasPresent) nextSet.delete(id)
      else nextSet.add(id)
      return nextSet
    })
    setStockMeta(prevMeta => {
      const nextMeta = new Map(prevMeta)
      if (wasPresent) nextMeta.delete(id)
      else if (!nextMeta.has(id)) nextMeta.set(id, { addedAt: stamp, expiresAt: null })
      return nextMeta
    })
    if (!user) persistGuest(proj)

    // v0.120 — appels DB déplacés HORS de l'updater de `setStock`.
    // Un updater doit être pur : React l'invoque DEUX FOIS en StrictMode
    // (actif en dev, cf. main.jsx) pour débusquer les effets de bord. Un
    // clic envoyait donc 2 upserts `user_stock` — constaté en E2E le
    // 2026-08-06. Sans conséquence sur les données (upsert idempotent,
    // StrictMode inactif en prod), mais une requête sur deux pour rien.
    // Même raison, même parade que `emitRemoved` plus haut : on s'appuie
    // sur `wasPresent`, lu depuis `stockRef` synchronisé au state courant.
    if (user) {
      if (wasPresent) removeFromStock(user.id, id)
      else addToStock(user.id, id)
    }
  }, [user])

  const resetStock = useCallback(async () => {
    // Ne supprime que les ingrédients réellement chargés : si la base n'a pas
    // répondu, l'écran montre un frigo vide, cette liste est vide, et le
    // vidage devient un no-op au lieu d'une purge de lignes jamais lues.
    if (user) await clearStock(user.id, stockRef.current)
    else { try { localStorage.removeItem(LOCALSTORAGE_KEY) } catch {} }
    poserProjection(new Set(), new Map())
    setStock(new Set())
    setStockMeta(new Map())
  }, [user])

  // Optimistic : vide le Set en mémoire seulement. La meta est conservée
  // (pour un undo qui restaure la fraîcheur) ; effacée par confirm.
  const emptyFridgeOptimistic = useCallback(() => {
    poserProjection(new Set(), metaRef.current)
    setStock(new Set())
  }, [])

  const emptyFridgeConfirm = useCallback(async () => {
    // À la confirmation (après la fenêtre undo), la meta porte encore les
    // items vidés (l'optimistic n'a vidé que le Set) → events anti-gaspi.
    const fn = onRemovedRef.current
    if (fn) {
      const removed = [...metaRef.current.entries()].map(([id, meta]) => ({ id, meta }))
      if (removed.length) fn(removed)
    }
    // Même garantie que `resetStock` : on ne supprime que ce qu'on a chargé.
    if (user) await clearStock(user.id, metaRef.current.keys())
    else { try { localStorage.removeItem(LOCALSTORAGE_KEY) } catch {} }
    poserProjection(stockRef.current, new Map())
    setStockMeta(new Map())
  }, [user])

  const emptyFridgeUndo = useCallback((stashed) => {
    const restaure = stashed instanceof Set ? stashed : new Set(stashed ?? [])
    poserProjection(restaure, metaRef.current)
    setStock(restaure)
  }, [])

  const addBatch = useCallback((ids) => {
    const arr = Array.isArray(ids) ? ids : [...(ids ?? [])]
    if (arr.length === 0) return []
    // Ce qui sera réellement ajouté, calculé HORS updater : les effets de bord
    // en dépendent, et un updater doit rester pur (v0.120).
    const proj = projection()
    const trulyAdded = [...new Set(arr)].filter(id => !proj.set.has(id))
    for (const id of trulyAdded) track('ingredient_added', { ingredientId: id })
    if (trulyAdded.length === 0) return arr

    const stamp = nowIso()
    for (const id of trulyAdded) {
      proj.set.add(id)
      if (!proj.meta.has(id)) proj.meta.set(id, { addedAt: stamp, expiresAt: null })
    }
    setStock(prevSet => {
      const nextSet = new Set(prevSet)
      for (const id of trulyAdded) nextSet.add(id)
      return nextSet
    })
    setStockMeta(prevMeta => {
      const nextMeta = new Map(prevMeta)
      for (const id of trulyAdded) if (!nextMeta.has(id)) nextMeta.set(id, { addedAt: stamp, expiresAt: null })
      return nextMeta
    })
    if (user) for (const id of trulyAdded) addToStock(user.id, id)
    else persistGuest(proj)
    return arr
  }, [user])

  const removeBatch = useCallback((ids) => {
    const arr = Array.isArray(ids) ? ids : [...(ids ?? [])]
    if (arr.length === 0) return
    const proj = projection()
    emitRemoved(arr, proj) // retraits groupés → events anti-gaspi
    for (const id of arr) { proj.set.delete(id); proj.meta.delete(id) }
    setStock(prevSet => {
      const nextSet = new Set(prevSet)
      for (const id of arr) nextSet.delete(id)
      return nextSet
    })
    setStockMeta(prevMeta => {
      const nextMeta = new Map(prevMeta)
      for (const id of arr) nextMeta.delete(id)
      return nextMeta
    })
    if (user) for (const id of arr) removeFromStock(user.id, id)
    else persistGuest(proj)
  }, [user])

  return {
    stock,
    stockMeta,
    setStock,
    setStockMeta,
    toggleIngredient,
    resetStock,
    emptyFridgeOptimistic,
    emptyFridgeConfirm,
    emptyFridgeUndo,
    addBatch,
    removeBatch,
  }
}
