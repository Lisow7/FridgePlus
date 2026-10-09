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
//   2. Calcul du scale desktop (`computeDesktopFridgeScale`), recalculé au
//      redimensionnement de la fenêtre ET de la zone principale ; seuil de
//      0.02 pour éviter les setState inutiles. Skip si <1280 (mobile/tablette).

// Plafond d'agrandissement volontairement modéré : au-delà, le transform:scale
// gonfle le texte (« trop gros ») et le ramollit (upscale d'un bitmap
// rasterisé). Cf. chantier lisibilité frigo.
const ECHELLE_MAX = 1.4
// Plancher : en dessous, les libellés du frigo passent sous 8 px.
const ECHELLE_MIN = 0.6
// Sur un grand écran, la place laissée autour du frigo : en-tête (64), retrait
// de la zone principale (96), pied et respiration (154). Inchangé depuis
// l'origine — c'est ce qui donne 1,13 à 1920 × 1080.
const MARGE_CONFORT = 314
// Sur un petit écran, on ne garde que de quoi absorber l'arrondi et le seuil
// de 0.02 (au pire 17 px sur 680), de chaque côté.
const MARGE_SERREE = 32
// Repli quand la zone principale n'est pas mesurable : en-tête + pied.
const HABILLAGE = 152

/**
 * Échelle de la rangée frigo + garde-manger en disposition ordinateur.
 *
 * Jusqu'au 2026-10-04 c'était `max(1, …)` : l'échelle grandissait mais ne
 * descendait jamais sous 1. Le frigo fait 680 px ; sur un portable (1366 × 768,
 * 1280 × 720…) il passait sous l'en-tête et le pied, dans une zone qui ne
 * défile pas (audit, P-02). Elle descend désormais jusqu'à `ECHELLE_MIN` pour
 * tenir dans la hauteur RÉELLEMENT disponible, mesurée et non supposée.
 *
 * @param {{ viewportHeight: number, availableHeight: number|null, rowHeight: number }} mesures
 */
export function computeDesktopFridgeScale({ viewportHeight, availableHeight, rowHeight }) {
  if (!rowHeight) return 1
  const agrandi = (viewportHeight - MARGE_CONFORT) / rowHeight
  if (agrandi >= 1) return Math.min(agrandi, ECHELLE_MAX)
  const disponible = availableHeight ?? (viewportHeight - HABILLAGE)
  const ajuste = (disponible - MARGE_SERREE) / rowHeight
  return Math.max(ECHELLE_MIN, Math.min(1, ajuste))
}

// Hauteur utile de la zone principale : sa hauteur moins ses retraits.
function hauteurDisponible(element) {
  const main = element.closest('main')
  if (!main) return null
  const style = getComputedStyle(main)
  const utile = main.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')
  return Number.isFinite(utile) && utile > 0 ? utile : null
}

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
      const s = computeDesktopFridgeScale({
        viewportHeight: window.innerHeight,
        availableHeight: hauteurDisponible(desktopFridgeRef.current),
        rowHeight: rowH,
      })
      setDesktopScale(prev => Math.abs(s - prev) > 0.02 ? Math.round(s * 100) / 100 : prev)
    }
    compute()
    window.addEventListener('resize', compute)
    // La zone principale change aussi de hauteur sans que la fenêtre bouge
    // (bandeau du haut, pied qui se replie) : on la suit.
    const main = desktopFridgeRef.current?.closest('main')
    const observateur = main && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null
    observateur?.observe(main)
    return () => {
      window.removeEventListener('resize', compute)
      observateur?.disconnect()
    }
  }, [windowWidth])

  return {
    footerExpanded,
    setFooterExpanded,
    footerRef,
    desktopScale,
    desktopFridgeRef,
  }
}
