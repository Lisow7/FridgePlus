import { useState, useRef, useCallback, useId } from 'react'
import { useAnchoredPopover } from '@shared/hooks/use-anchored-popover'
import { useFermetureDifferee } from '@shared/hooks/use-fermeture-differee'
import { AnchoredBubble } from './anchored-popover'

// Tooltip PASSIF : enrobe un contrôle déjà visible (bouton icône-seule,
// badge) et révèle une aide courte au survol souris ou au focus clavier —
// DESKTOP UNIQUEMENT. N'intercepte PAS le clic → l'action du bouton enrobé
// continue de fonctionner. Positionnement robuste (portail fixed, clamp,
// flip) via anchored-popover → jamais rogné. Règle d'usage : cf.
// docs/ui/tooltips.md.
//
// Volontairement AUCUNE bulle sur tactile (téléphone/tablette) — retour
// utilisateur 2026-07-11 : le survol est un concept exclusif desktop ; sur
// tactile, une bulle révélée au tap n'a pas de "sortie" naturelle et flotte
// en redondance par-dessus le panneau/la modale que ce même tap ouvre par
// ailleurs (capture d'écran fournie : bulle "Aide & infos" flottant sur la
// page Communauté). Détection alignée sur InfoTooltip
// (shared/ui/info-tooltip.jsx) : (hover: hover) and (pointer: fine) — un
// mobile/tablette tactile n'a jamais ces deux caractéristiques. Un simple
// filtre sur onTouchStart ne suffirait pas : taper un bouton donne aussi le
// focus ET synthétise des événements souris de compatibilité (mouseenter…)
// sur mobile — onFocusCapture/onMouseEnter doivent donc être coupés aussi,
// pas seulement le fallback tactile dédié.
export default function Tooltip({ text, children, darkMode = false, width = 200, disabled = false }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const tipId = useId()

  const canHover = typeof window !== 'undefined'
    && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

  const fermer = useCallback(() => setOpen(false), [])
  // Quitter l'ancre ou la bulle ferme après un court délai, le temps que le
  // pointeur traverse l'espace entre les deux ; y entrer annule la fermeture
  // (WCAG 1.4.13 ; audit du 2026-10-04, A11Y-22). Un clic, Échap et la perte
  // du focus ferment tout de suite.
  const { fermerBientot, annulerLaFermeture } = useFermetureDifferee(fermer)
  const close = useCallback(() => { annulerLaFermeture(); fermer() }, [annulerLaFermeture, fermer])
  const openNow = useCallback(() => {
    annulerLaFermeture()
    if (text && !disabled) setOpen(true)
  }, [annulerLaFermeture, text, disabled])

  // Focus « visible » uniquement (Tab clavier) — PAS tout focus. Un clic
  // donne aussi le focus (Windows/Chrome notamment), et `useFocusTrap`
  // restaure le focus sur le déclencheur à la fermeture d'une modale (bonne
  // pratique a11y) : sans ce filtre, fermer la visite guidée depuis la
  // fusée refocalise la fusée et rouvre la bulle sans aucun survol ni
  // intention utilisateur (retour utilisateur 2026-07-11). `:focus-visible`
  // ne matche que l'interaction clavier dans les navigateurs modernes.
  const openOnKeyboardFocus = useCallback((e) => {
    if (e.target.matches?.(':focus-visible')) openNow()
  }, [openNow])

  const pos = useAnchoredPopover({ anchorRef, open, onClose: close, width })

  if (!text || !canHover) return children

  return (
    <span
      ref={anchorRef}
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={openNow}
      onMouseLeave={fermerBientot}
      onFocusCapture={openOnKeyboardFocus}
      onBlurCapture={close}
      // Un clic donne le focus au bouton enrobé (le mouseenter précédent ne
      // se dissipe jamais tant que la souris ne bouge pas) → la bulle reste
      // affichée par-dessus l'écran/la modale que ce même clic vient
      // d'ouvrir. Un clic est une action, pas une intention de survol : on
      // ferme immédiatement (retour utilisateur desktop, 2026-07-11).
      onClick={close}
      aria-describedby={open ? tipId : undefined}
    >
      {children}
      <AnchoredBubble
        pos={pos}
        id={tipId}
        darkMode={darkMode}
        onMouseEnter={annulerLaFermeture}
        onMouseLeave={fermerBientot}
        style={{ textAlign: 'center', padding: '7px 11px', fontWeight: 600 }}
      >
        {text}
      </AnchoredBubble>
    </span>
  )
}
