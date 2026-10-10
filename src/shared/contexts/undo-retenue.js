// La retenue d'une suppression annulable (WCAG 2.2.1, audit du 2026-10-04,
// A11Y-12) : sous la souris ou avec le focus dedans, le compte à rebours
// s'arrête ; il repart avec le temps restant (une seconde au moins) quand plus
// rien ne le retient. `pauseAt` fige aussi la barre de compte à rebours.
//
// Fonctions pures vis-à-vis de React : elles reçoivent la pile (sa référence
// qui fait foi, `stackRef`), les minuteurs et `commit`, et ne décident que sur
// ces valeurs — sorties d'`UndoProvider` pour le garder sous ses 100 lignes.

export function retenir({ stackRef, timersRef, commit }, id, cause) {
  const item = stackRef.current.find(t => t.id === id)
  if (!item) return
  const retenuPar = new Set(item.retenuPar ?? [])
  retenuPar.add(cause)
  if (item.pauseAt != null) {
    commit(stackRef.current.map(t => (t.id === id ? { ...t, retenuPar } : t)))
    return
  }
  const timer = timersRef.current.get(id)
  if (timer) {
    clearTimeout(timer)
    timersRef.current.delete(id)
  }
  commit(stackRef.current.map(t => (t.id === id ? { ...t, pauseAt: Date.now(), retenuPar } : t)))
}

export function relacher({ stackRef, commit, armer }, id, cause) {
  const item = stackRef.current.find(t => t.id === id)
  if (!item || item.pauseAt == null) return
  const retenuPar = new Set(item.retenuPar ?? [])
  retenuPar.delete(cause)
  if (retenuPar.size > 0) {
    commit(stackRef.current.map(t => (t.id === id ? { ...t, retenuPar } : t)))
    return
  }
  const reste = Math.max(1000, item.expireAt - item.pauseAt)
  commit(stackRef.current.map(t => (t.id === id ? { ...t, expireAt: Date.now() + reste, pauseAt: undefined, retenuPar: undefined } : t)))
  armer(id, reste)
}
