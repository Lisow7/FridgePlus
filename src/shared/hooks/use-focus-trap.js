import { useEffect, useRef } from 'react'

// Hook a11y pour piéger le focus clavier dans une modale.
//
// Comportement attaché à un container ref :
// 1. À l'ouverture (active=true), focalise le 1er élément focusable.
// 2. Tab sur le dernier élément → boucle sur le 1er. Shift+Tab sur le 1er
//    → boucle sur le dernier. Tab/Shift+Tab ailleurs → comportement natif.
// 3. À la fermeture (active=false ou démontage), restaure le focus sur
//    l'élément qui avait le focus avant l'ouverture (déclencheur).
// 4. Optionnellement, Escape déclenche le callback `onEscape`.
//
// Usage :
//   const ref = useRef(null)
//   useFocusTrap(ref, { active: isOpen, onEscape: () => setOpen(false) })
//   return <div ref={ref} role="dialog" aria-modal="true">…</div>
//
// Pourquoi pas focus-trap-react : le repo n'a pas la lib en deps, le besoin
// est restreint à une dizaine de modales, et le coût d'un hook ad hoc
// (~50 lignes) est inférieur à la maintenance d'une dépendance externe.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ')

function getFocusable(container) {
  if (!container) return []
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(el => {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    // Les éléments cachés via CSS ne sont pas focusables clavier.
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return true
  })
}

// Pile des pièges ACTIFS, dans l'ordre de montage. Deux pièges peuvent être
// actifs en même temps (ConfirmModal par-dessus RecipeModal) : comme chacun
// écoute désormais `document`, sans cette pile un seul Escape fermerait LES
// DEUX modales et un Tab serait traité deux fois. Seul le SOMMET agit.
const activeTraps = []

export function useFocusTrap(containerRef, { active = true, onEscape } = {}) {
  // Mémorise l'élément focalisé avant l'ouverture, pour pouvoir le restaurer
  // à la fermeture. Évite de perdre le focus dans le néant après une modale.
  const previousFocusRef = useRef(null)

  // onEscape est souvent une fonction recréée à chaque render du parent
  // (ex. `function handleCancel()` inline). On la garde dans un ref pour
  // que l'effet principal NE dépende PAS de son identité — sinon il se
  // relance à chaque frappe clavier et re-vole le focus sur le 1er élément
  // focusable (la croix de fermeture). Bug observé sur la saisie du code MFA.
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape }, [onEscape])

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    // Focus initial : 1er élément focusable, ou le container lui-même si
    // aucun (fallback pour les modales avec uniquement du texte + close).
    // On ne force le focus QUE si rien n'est déjà focalisé à l'intérieur —
    // ainsi un champ en `autoFocus` (ex. l'input du code MFA) garde le focus
    // au lieu de se le faire voler par la croix.
    if (!container.contains(document.activeElement)) {
      const focusables = getFocusable(container)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else if (container.tabIndex !== -1 && typeof container.focus === 'function') {
        container.focus()
      }
    }

    function onKeyDown(e) {
      // Seul le piège au SOMMET de la pile traite le clavier — voir la note
      // sur `activeTraps` plus haut.
      if (activeTraps[activeTraps.length - 1] !== container) return
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = getFocusable(container)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // `!container.contains(activeEl)` : le focus s'est échappé (élément
        // focalisé démonté → focus sur <body>, retour de la barre d'URL…).
        // Tab le RAMÈNE dans la modale au lieu de partir dans la page de fond.
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    // 🔴 `document` et non `container` : quand l'élément focalisé est démonté,
    // le navigateur pose le focus sur <body> SANS dispatcher d'événement focus.
    // Un écouteur sur le container ne reçoit alors plus ni Tab ni Escape — le
    // piège était MORT et l'utilisateur clavier coincé (audit 2026-08-25).
    activeTraps.push(container)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const i = activeTraps.lastIndexOf(container)
      if (i !== -1) activeTraps.splice(i, 1)
      // Restauration du focus au déclencheur. document.contains permet
      // d'éviter une erreur si l'élément a entre-temps été démonté.
      const previous = previousFocusRef.current
      if (previous && document.contains(previous) && typeof previous.focus === 'function') {
        previous.focus()
      }
    }
  }, [active, containerRef])
}
