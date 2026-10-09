import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import UndoToastStack from '@shared/ui/undo-toast-stack'

// Mécanisme universel de suppression annulable.
//
// Pattern « undo toast » : quand l'utilisateur déclenche une action
// destructive, on retire l'item de la UI immédiatement (optimistic update),
// on affiche un toast en bas de l'écran avec un compte à rebours de 10
// secondes et un bouton « Annuler ». Si l'utilisateur clique « Annuler »,
// l'item est restauré (callback `onUndo`). Sinon, à expiration du timer,
// la suppression est confirmée côté BDD (callback `onConfirm`).
//
// Stratégie technique « stash mémoire » :
//   - On garde l'item retiré dans le state local de l'app pendant les 10s.
//   - On n'appelle l'API delete qu'à expiration du timer.
//   - Si l'user ferme l'onglet pendant les 10s, le timer ne s'exécute pas
//     → l'item reste en BDD. Au prochain refresh, il réapparaîtra côté
//     UI tant qu'il n'a pas été réellement supprimé. Acceptable (zéro
//     fuite de données, juste un effet de bord léger côté UX).
//
// Pour les actions soumises à la RGPD Art.17 (suppression compte,
// suppression recette personnelle), on garde les modales dédiées avec
// délais propres (déjà en place — pas concernées par ce mécanisme).

const UndoContext = createContext({
  trigger: () => {},
  undo: () => {},
  flushAll: () => {},
})

export function UndoProvider({ children, lang = 'fr', darkMode = false }) {
  const [stack, setStack] = useState([])
  // timersRef : Map(id → timeoutId). Référence stable même quand stack change,
  // évite que le cleanup d'un useEffect annule des timers actifs.
  const timersRef = useRef(new Map())

  // ⚠️ stackRef est la SOURCE DE VÉRITÉ des décisions ; `stack` ne sert qu'au
  // rendu. Motif : les callbacks métier (`onConfirm` = suppression réelle en
  // base, `onUndo` = restauration) étaient appelés DANS des updaters de
  // `setStack`. Or React invoque les updaters DEUX fois en StrictMode pour
  // débusquer les effets de bord impurs — chaque suppression partait donc en
  // double. Même classe de défaut que la régression corrigée le 2026-08-06 sur
  // `useFridgeStock` (un clic → deux upserts), prouvée ici par
  // `undo-provider-updater-purity.test.jsx`.
  //
  // Une simple variable locale ne suffirait PAS à sortir l'effet de l'updater :
  // `setState` est asynchrone, l'updater ne s'exécute pas au moment de l'appel.
  // D'où ce ref, mis à jour de façon synchrone par `commit()`, qui permet de
  // décider AVANT de rendre — et d'appeler les callbacks exactement une fois.
  const stackRef = useRef([])

  const commit = useCallback((next) => {
    stackRef.current = next
    setStack(next)
  }, [])

  // Exécute un callback métier hors de tout updater, sans jamais faire échouer
  // l'appelant : une suppression qui rate ne doit pas casser l'interface.
  const executer = useCallback((fn, tag) => {
    Promise.resolve(fn?.()).catch(err => {
      if (import.meta.env.DEV) console.error(`[undo] ${tag} failed`, err)
    })
  }, [])

  const trigger = useCallback(({ label, onConfirm, onUndo, durationMs = 10000 }) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const expireAt = Date.now() + durationMs
    const entree = { id, label, expireAt, onConfirm, onUndo }

    // Limite le stack à 3 toasts visibles : si on en a déjà 3, on flush
    // le plus ancien (= confirme sa suppression), pour éviter un mur de
    // toasts qui mange l'écran sur mobile.
    const courant = stackRef.current
    const evince = courant.length >= 3 ? courant[0] : null
    commit(evince ? [...courant.slice(1), entree] : [...courant, entree])

    if (evince) {
      const timer = timersRef.current.get(evince.id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(evince.id)
      }
      // Confirme l'ancien immédiatement (sa suppression réelle).
      executer(evince.onConfirm, 'flush-on-cap onConfirm')
    }

    const timeoutId = setTimeout(async () => {
      try {
        await onConfirm?.()
      } catch (err) {
        if (import.meta.env.DEV) console.error('[undo] onConfirm failed', err)
      }
      commit(stackRef.current.filter(t => t.id !== id))
      timersRef.current.delete(id)
    }, durationMs)

    timersRef.current.set(id, timeoutId)
  }, [commit, executer])

  const undo = useCallback((id) => {
    const item = stackRef.current.find(t => t.id === id)
    if (!item) return
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    commit(stackRef.current.filter(t => t.id !== id))
    executer(item.onUndo, 'onUndo')
  }, [commit, executer])

  // Confirme tous les toasts en attente. Utile par exemple si on ferme
  // une modale parente : on ne veut pas garder de toasts orphelins.
  const flushAll = useCallback(() => {
    const enAttente = stackRef.current
    commit([])
    for (const item of enAttente) {
      const timer = timersRef.current.get(item.id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(item.id)
      }
      executer(item.onConfirm, 'flushAll onConfirm')
    }
  }, [commit, executer])

  // Cleanup au unmount : annule tous les timers (sans déclencher onConfirm
  // pour éviter une cascade d'écritures BDD pendant un teardown).
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  // Mémoïsation du value Provider (cf. PR S3.b).
  // Les 3 callbacks (trigger, undo, flushAll) sont déjà stables grâce
  // aux useCallback en amont. L'objet wrapper est désormais stable aussi.
  const value = useMemo(() => ({ trigger, undo, flushAll }), [trigger, undo, flushAll])

  return (
    <UndoContext.Provider value={value}>
      {children}
      <UndoToastStack stack={stack} onUndo={undo} lang={lang} darkMode={darkMode} />
    </UndoContext.Provider>
  )
}

export function useUndo() {
  return useContext(UndoContext)
}
