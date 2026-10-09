import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'

// Logique commune des menus déroulants du header : état ouvert/fermé,
// focus-trap + Escape, click-outside (mousedown), et calcul de position
// `fixed` sous le trigger. Renvoie { open, setOpen, menuRef, dropPos }.
// Remplace la logique dupliquée dans UserMenu / GuestMenu / PreferencesMenu.
export function useDropdownMenu(triggerRef) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef(null)

  const closeMenu = useCallback(() => setOpen(false), [])

  useFocusTrap(menuRef, { active: open, onEscape: closeMenu })

  // Position : sous le trigger, aligné à droite.
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
  }, [open, triggerRef])

  // Click-outside (mousedown) : ferme si clic hors menu ET hors trigger.
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, triggerRef])

  // Flèches (motif WAI-ARIA menu button, 2026-09-11) : ↑/↓ circulent entre les
  // entrées `menuitem` non désactivées, en boucle ; Début/Fin sautent aux
  // extrémités. Le piège de focus gère déjà Tab/Escape et pose le focus sur la
  // première entrée à l'ouverture — on ne s'occupe ici que de la circulation.
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const menu = menuRef.current
      if (!menu || !menu.contains(document.activeElement)) return
      const items = [...menu.querySelectorAll('[role="menuitem"]:not([disabled])')]
      if (items.length === 0) return
      e.preventDefault()
      const i = items.indexOf(document.activeElement)
      let cible
      if (e.key === 'Home') cible = items[0]
      else if (e.key === 'End') cible = items[items.length - 1]
      else if (e.key === 'ArrowDown') cible = items[(i + 1) % items.length]
      else cible = items[(i - 1 + items.length) % items.length]
      cible.focus()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return { open, setOpen, menuRef, dropPos }
}
