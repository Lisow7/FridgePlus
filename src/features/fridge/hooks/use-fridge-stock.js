import { useState, useCallback, useEffect, useRef } from 'react'
import { addToStock, removeFromStock, clearStock } from '@features/fridge/api/stock'
import { track } from '@shared/lib/observability/track'
import { createWriteSeries } from '@shared/lib/optimistic-writes'

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
//
// 🔴 Une écriture refusée par la base ANNULE ce qu'elle avait affiché, et le
// dit (`onSaveError`). Jusqu'au 2026-10-04 le résultat de chaque écriture était
// jeté : l'aliment restait coché, rien n'était enregistré, et il disparaissait
// au rechargement sans un mot (audit UX-02). L'écran change toujours tout de
// suite ; c'est le refus, s'il arrive, qui le remet d'accord avec la base —
// y compris quand deux écritures du même aliment se croisent (la règle est
// dans `shared/lib/optimistic-writes.js`).

const LOCALSTORAGE_KEY = 'fridge-stock'
const nowIso = () => new Date().toISOString()

// Vidage en base ; un appel qui lève (réseau coupé) rend une erreur comme les autres.
async function vider(userId, ids) {
  try { return await clearStock(userId, ids) } catch (err) { return { error: err ?? new Error('unknown') } }
}

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

export function useFridgeStock(user, { onRemoved, onSaveError } = {}) {
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
  // Lus seulement après la réponse de la base : synchronisés après le rendu.
  const onSaveErrorRef = useRef(onSaveError)
  useEffect(() => { onSaveErrorRef.current = onSaveError }, [onSaveError])
  // Le compte affiché : une réponse en retard d'un compte ne doit pas toucher
  // l'écran du suivant (même fuite que celle fermée le 2026-08-28 pour le
  // chargement, cf. `use-user-session.js`).
  const userIdRef = useRef(user?.id)
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])

  // Les écritures en vol, aliment par aliment : c'est ce registre qui dit, à
  // la réponse de la base, ce que l'écran doit afficher.
  const [series] = useState(createWriteSeries)

  // Suit des écritures parties vers la base ; quand la base en refuse, remet
  // l'écran d'accord avec elle.
  //   ecritures : [{ id, envoi: () => Promise<{ error }>, avant, apres }]
  //   `avant` / `apres` = l'aliment avant et après le geste : sa fraîcheur
  //   s'il est au frigo, `null` sinon.
  const suivre = useCallback((ecritures) => {
    const emetteur = user.id
    const suivies = ecritures.map(({ id, envoi, avant, apres }) => {
      // Registre tenu PAR COMPTE : l'écriture encore en vol d'un compte qui
      // vient de se déconnecter ne doit pas retenir celles du suivant.
      const ecriture = series.ouvrir(`${emetteur}|${id}`, avant, apres)
      let reponse
      try { reponse = Promise.resolve(envoi()) } catch (err) { reponse = Promise.reject(err) }
      // Un appel qui lève (réseau coupé) compte comme un refus.
      return { id, ecriture, refusee: reponse.then((resultat) => !!resultat?.error, () => true) }
    })
    Promise.all(suivies.map((s) => s.refusee)).then((refus) => {
      const aRemettre = []
      suivies.forEach((s, i) => {
        const verdict = series.fermer(s.ecriture, refus[i])
        if (verdict) aRemettre.push({ id: s.id, etat: verdict.etat, voulu: verdict.voulu })
      })
      // Le compte a changé pendant le vol : cette réponse ne concerne plus
      // l'écran affiché.
      if (aRemettre.length === 0 || userIdRef.current !== emetteur) return
      setStock((prevSet) => {
        const nextSet = new Set(prevSet)
        for (const { id, etat } of aRemettre) { if (etat) nextSet.add(id); else nextSet.delete(id) }
        return nextSet
      })
      setStockMeta((prevMeta) => {
        const nextMeta = new Map(prevMeta)
        for (const { id, etat } of aRemettre) { if (etat) nextMeta.set(id, etat); else nextMeta.delete(id) }
        return nextMeta
      })
      // On ne le dit que si la personne n'a pas ce qu'elle voulait : un aliment
      // qu'elle a retiré et qui n'est pas en base, c'est ce qu'elle demandait.
      if (aRemettre.some(({ etat, voulu }) => !!etat !== !!voulu)) onSaveErrorRef.current?.()
    })
  }, [user, series])

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
    // Fraîcheur d'avant, à remettre si la base refuse le retrait.
    const metaAvant = wasPresent ? (proj.meta.get(id) ?? { addedAt: nowIso(), expiresAt: null }) : null
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
      suivre([{
        id,
        envoi: () => (wasPresent ? removeFromStock(user.id, id) : addToStock(user.id, id)),
        avant: metaAvant,
        apres: wasPresent ? null : proj.meta.get(id),
      }])
    }
  }, [user, suivre])

  const resetStock = useCallback(async () => {
    // Ne supprime que les ingrédients réellement chargés : si la base n'a pas
    // répondu, l'écran montre un frigo vide, cette liste est vide, et le
    // vidage devient un no-op au lieu d'une purge de lignes jamais lues.
    if (user) {
      // Vidage refusé : rien n'est vidé à l'écran non plus.
      const { error } = await vider(user.id, stockRef.current)
      if (error) { onSaveErrorRef.current?.(); return { error } }
    } else { try { localStorage.removeItem(LOCALSTORAGE_KEY) } catch {} }
    poserProjection(new Set(), new Map())
    setStock(new Set())
    setStockMeta(new Map())
    return { error: null }
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
    if (user) {
      const { error } = await vider(user.id, metaRef.current.keys())
      if (error) {
        // Le vidage n'a pas eu lieu : le frigo revient tel qu'il était (la
        // fraîcheur, elle, n'avait pas bougé).
        const restaure = new Set(metaRef.current.keys())
        poserProjection(restaure, metaRef.current)
        setStock(restaure)
        onSaveErrorRef.current?.()
        return { error }
      }
    } else { try { localStorage.removeItem(LOCALSTORAGE_KEY) } catch {} }
    poserProjection(stockRef.current, new Map())
    setStockMeta(new Map())
    return { error: null }
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
    if (user) suivre(trulyAdded.map((id) => ({ id, envoi: () => addToStock(user.id, id), avant: null, apres: proj.meta.get(id) })))
    else persistGuest(proj)
    return arr
  }, [user, suivre])

  const removeBatch = useCallback((ids) => {
    const arr = Array.isArray(ids) ? ids : [...(ids ?? [])]
    if (arr.length === 0) return
    const proj = projection()
    // Ce qui était vraiment là, avec sa fraîcheur : à remettre si la base refuse.
    const retires = [...new Set(arr)].filter((id) => proj.set.has(id))
      .map((id) => ({ id, avant: proj.meta.get(id) ?? { addedAt: nowIso(), expiresAt: null } }))
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
    if (user) {
      const dejaSuivis = new Set(retires.map((r) => r.id))
      suivre(retires.map(({ id, avant }) => ({ id, envoi: () => removeFromStock(user.id, id), avant, apres: null })))
      // Un identifiant absent du frigo part quand même vers la base, comme
      // avant : il n'y a rien à remettre s'il est refusé.
      for (const id of arr) if (!dejaSuivis.has(id)) removeFromStock(user.id, id)
    } else persistGuest(proj)
  }, [user, suivre])

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
