import { useEffect, useRef } from 'react'

// Un rafraîchissement périodique qui ne tourne que si quelqu'un regarde
// (audit du 2026-10-04, ADM-12 (3)) : onglet du navigateur visible ET écran
// concerné affiché (`actif`). Au retour sur l'onglet, une lecture rattrape le
// retard si la dernière (`dernierControle`, une Date) date de plus de
// `intervalleMs`. Avant, l'onglet Qualité retéléchargeait ses deux vues de
// santé toutes les cinq minutes, onglet masqué ou non.
export function useRafraichissementSousLesYeux({ reload, actif = true, dernierControle = null, intervalleMs }) {
  const dernierRef = useRef(dernierControle)
  useEffect(() => { dernierRef.current = dernierControle }, [dernierControle])

  useEffect(() => {
    if (!actif) return undefined
    const visible = () => document.visibilityState !== 'hidden'
    const auTic = () => { if (visible()) reload() }
    const auRetour = () => {
      if (!visible()) return
      const depuis = Date.now() - (dernierRef.current?.getTime?.() ?? 0)
      if (depuis >= intervalleMs) reload()
    }
    const minuteur = setInterval(auTic, intervalleMs)
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      clearInterval(minuteur)
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [reload, actif, intervalleMs])
}
