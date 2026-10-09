import { useState, useEffect, useCallback } from 'react'

// Positionnement robuste et partagé pour les bulles ancrées (tooltips, bouton
// « i », popover glossaire). La bulle est rendue par <AnchoredBubble> en
// position:fixed (portail) → jamais rognée par un conteneur scrollable, clampée
// au viewport, bascule au-dessus / en dessous de l'ancre selon la place.

const GAP = 8      // espace ancre ↔ bulle
const MARGIN = 12  // marge mini par rapport aux bords du viewport

/**
 * Calcule une position fixed sûre à partir du rect de l'ancre.
 * @param {HTMLElement} anchor
 * @param {number} width largeur logique (sert au clamp horizontal)
 * @returns {{left,top?,bottom?,width,maxH,placement}|null}
 */
function computeAnchoredPosition(anchor, width) {
  if (!anchor) return null
  const r = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(width, vw - 2 * MARGIN)
  const rawLeft = r.left + r.width / 2 - w / 2
  const left = Math.max(MARGIN, Math.min(rawLeft, vw - w - MARGIN))
  const spaceAbove = r.top - GAP - MARGIN
  const spaceBelow = vh - r.bottom - GAP - MARGIN
  if (spaceAbove >= spaceBelow) {
    return { left, bottom: vh - r.top + GAP, width: w, maxH: spaceAbove, placement: 'above' }
  }
  return { left, top: r.bottom + GAP, width: w, maxH: spaceBelow, placement: 'below' }
}

/**
 * Gère l'état de position + la fermeture sur scroll / resize / Escape.
 * L'ouverture (hover / click / tap) est pilotée par le composant appelant.
 * @param {{ anchorRef, open:boolean, onClose:()=>void, width?:number }} p
 * @returns position | null
 */
export function useAnchoredPopover({ anchorRef, open, onClose, width = 260 }) {
  const [pos, setPos] = useState(null)

  const recompute = useCallback(() => {
    setPos(computeAnchoredPosition(anchorRef.current, width))
  }, [anchorRef, width])

  // Mesure du DOM après rendu (rect de l'ancre) → setState en effet légitime.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos(null)
      return
    }
    recompute()
    const onScrollOrResize = () => onClose?.()
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('scroll', onScrollOrResize, true) // capture = tous conteneurs
    window.addEventListener('resize', onScrollOrResize)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, recompute, onClose])

  return pos
}
