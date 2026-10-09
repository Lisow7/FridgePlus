import { useState, useEffect, useRef } from 'react'

// Hook regroupant les états et effets responsive de l'app shell :
// bottom sheet footer mobile (peek 36px, tap pour déployer) + scale
// dynamique du frigo desktop (agrandit jusqu'à remplir l'écran).
// Sprint 10 S10.a.11 — extrait depuis App.jsx.
//
// Renvoie :
//   - footerExpanded            : boolean — sheet footer mobile déployé
//   - setFooterExpanded         : setter (toggle au tap)
//   - footerRef                 : ref du footer (réservation hauteur tablette)
//   - desktopScale              : nombre — scale appliqué au frigo desktop
//   - desktopFridgeRef          : ref de la rangée frigo desktop (mesure
//                                 offsetHeight pour calcul scale)
//
// Effets internes :
//   1. Auto-fermeture du footer mobile dès qu'une porte frigo OU un
//      compartiment garde-manger s'ouvre, OU dès qu'on quitte la home.
//   2. Calcul du scale desktop : (window.innerHeight − 314) / rowH,
//      borné [1, 1.75]. Recompute au resize, threshold 0.02 pour
//      éviter les setState inutiles. Skip si <1280 (mobile/tablette).

export function useResponsiveLayout({
  windowWidth,
  anyDoorOpen,
  anyPantryOpen,
  isHome,
}) {
  const [footerExpanded, setFooterExpanded] = useState(false)
  useEffect(() => { if (anyDoorOpen || anyPantryOpen) setFooterExpanded(false) }, [anyDoorOpen, anyPantryOpen])
  useEffect(() => { if (!isHome) setFooterExpanded(false) }, [isHome])

  const footerRef = useRef(null)

  const desktopFridgeRef = useRef(null)
  const [desktopScale, setDesktopScale] = useState(1)
  useEffect(() => {
    const compute = () => {
      if (windowWidth < 1280 || !desktopFridgeRef.current) return
      const rowH = desktopFridgeRef.current.offsetHeight
      if (!rowH) return
      // Espace dispo : viewport − header(64) − main pt-24(96)
      //                − zone bouton(134) − marge(20)
      // Plafond d'agrandissement volontairement modéré (1.4) : au-delà, le
      // transform:scale gonfle le texte (« trop gros ») et le ramollit (upscale
      // d'un bitmap rasterisé). Cf. chantier lisibilité frigo.
      const s = Math.max(1, Math.min((window.innerHeight - 314) / rowH, 1.4))
      setDesktopScale(prev => Math.abs(s - prev) > 0.02 ? Math.round(s * 100) / 100 : prev)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [windowWidth])

  return {
    footerExpanded,
    setFooterExpanded,
    footerRef,
    desktopScale,
    desktopFridgeRef,
  }
}
