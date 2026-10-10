import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { useAnchoredPopover } from '@shared/hooks/use-anchored-popover'
import { useFermetureDifferee } from '@shared/hooks/use-fermeture-differee'
import { useLang } from '@shared/contexts/ui-provider'
import { AnchoredBubble } from './anchored-popover'

// Bouton « i » VISIBLE + bulle d'explication (survol / tap). Réservé à une aide
// optionnelle plus longue sur une notion (cf. règle docs/ui/tooltips.md).
// Positionnement robuste partagé (portail fixed, clamp viewport, flip) → la
// bulle n'est plus jamais rognée par un conteneur scrollable (ancien bug :
// largeur fixe 300 + toujours au-dessus, sans clamp ni flip).

const I18N = {
  fr: { info: 'Informations' },
  en: { info: 'Information' },
}

const PULSE_CSS = `
@keyframes info-btn-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(224,120,32,0.55); transform: scale(1); }
  50%  { box-shadow: 0 0 0 7px rgba(224,120,32,0); transform: scale(1.08); }
  100% { box-shadow: 0 0 0 0 rgba(224,120,32,0); transform: scale(1); }
}
.info-tooltip-btn { animation: info-btn-pulse 1s ease-out 0.6s 2; transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
/* :hover réservé aux vrais pointeurs (souris) — sur tactile (iOS notamment),
   un :hover déclenché au premier tap piège l'utilisateur dans un "premier tap
   = survol, second tap = clic réel". cf. chantier scroll/tap mobile 2026-07-09. */
@media (hover: hover) and (pointer: fine) {
  .info-tooltip-btn:hover { transform: scale(1.12) !important; box-shadow: 0 3px 12px rgba(224,120,32,0.55) !important; }
}
`

/**
 * Bouton ℹ avec bulle tooltip au survol/tap.
 * Props : text (string|node), darkMode (bool). (`align` conservé pour compat, ignoré : placement auto.)
 */
export default function InfoTooltip({ text, darkMode = false }) {
  const { lang } = useLang()
  const t = I18N[lang] ?? I18N.fr
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const popRef = useRef(null)
  const tipId = useId()

  const close = useCallback(() => setOpen(false), [])
  const pos = useAnchoredPopover({ anchorRef, open, onClose: close, width: 300 })
  // Au survol, la bulle se laisse survoler : quitter la pastille ou la bulle
  // ferme après un court délai, y entrer annule (WCAG 1.4.13 ; audit du
  // 2026-10-04, A11Y-22).
  const { fermerBientot, annulerLaFermeture } = useFermetureDifferee(close)

  // Le survol (mouseenter/mouseleave) ne doit piloter l'ouverture que sur un
  // vrai pointeur (souris). Sur tactile, un tap synthétise mouseenter ET
  // click dans le même geste — le toggle du clic annulait aussitôt
  // l'ouverture du survol (course gagnée par le clic, bulle jamais visible
  // au premier tap réel — bug trouvé par test, pas par le CSS :hover, cf.
  // chantier tap mobile 2026-07-09). Sur tactile, seul le clic pilote l'état.
  const canHover = typeof window !== 'undefined'
    && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

  // Ouverture au clic (sticky) → fermer au clic extérieur.
  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <>
      <style>{PULSE_CSS}</style>
      <span
        ref={anchorRef}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        onMouseEnter={canHover ? () => { annulerLaFermeture(); setOpen(true) } : undefined}
        onMouseLeave={canHover ? fermerBientot : undefined}
      >
        <button
          type="button"
          className="info-tooltip-btn"
          onClick={() => setOpen(v => !v)}
          aria-label={t.info}
          aria-describedby={open ? tipId : undefined}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', border: 'none',
            background: darkMode ? 'rgba(224,120,32,0.9)' : 'var(--color-brand-500)',
            boxShadow: '0 2px 8px rgba(224,120,32,0.40)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800, fontStyle: 'italic', color: '#FFFFFF',
            padding: 0, lineHeight: 1, flexShrink: 0,
          }}
        >
          i
        </button>
        <AnchoredBubble
          pos={pos}
          popRef={popRef}
          id={tipId}
          darkMode={darkMode}
          onMouseEnter={canHover ? annulerLaFermeture : undefined}
          onMouseLeave={canHover ? fermerBientot : undefined}
          style={{ fontSize: '14px', lineHeight: 1.6, padding: '14px 16px', borderRadius: '14px' }}
        >
          {text}
        </AnchoredBubble>
      </span>
    </>
  )
}
