import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Z_INDEX } from '@shared/lib/z-index'
// (Le dictionnaire I18N local a disparu avec l'`aria-label` du wrapper : il
// vivait sur un div sans rôle, donc ARIA l'ignorait — et les régions vives
// n'ont pas besoin de nom, chaque toast porte son propre texte.)

// Sprint 6 PR S6.c — ToastProvider générique.
//
// Pattern recommandé par les best practices React 2026 (cf.
// https://blog.frontendpro.dev/build-a-custom-toast-notification-component-with-reactjs-context-api,
// https://medium.com/@dhakalrohan225/building-a-toast-notification-system-in-react-js-next-js-f902ed4a67e3) :
//   - useReducer pour la queue (ajout/suppression/replace)
//   - Context exposé via hook custom `useToast()`
//   - React.createPortal pour rendre dans `<body>` (évite conflits stack/z-index)
//   - ARIA : `role="status"` + `aria-live="polite"` (annoncé aux lecteurs
//     d'écran sans interrompre la lecture en cours)
//   - Auto-dismiss configurable par toast (timeout)
//
// API minimaliste :
//   const { show, dismiss, replace } = useToast()
//   const id = show(<MyToastContent />, { duration: 5000 })
//   dismiss(id)
//
// Pour les toasts avec action (bouton "Annuler" / "Restaurer"), le
// caller fournit le ReactNode complet avec son bouton + callback. Le
// ToastProvider ne gère pas l'action — il gère juste la file et le
// dismiss. Cela permet de garder le style propre à chaque toast (icon,
// gradient, couleurs) tout en éliminant le useState + useRef du timer.
//
// Pour les actions destructives avec confirm-retardé (10s avant
// suppression réelle), garder `UndoProvider` qui a une sémantique
// différente (stash mémoire + confirm/undo callbacks).

const ToastContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'show':
      // Si un toast existe déjà avec ce id, on le remplace au lieu d'empiler.
      return state.some(t => t.id === action.toast.id)
        ? state.map(t => t.id === action.toast.id ? action.toast : t)
        : [...state, action.toast]
    case 'dismiss':
      return state.filter(t => t.id !== action.id)
    case 'clear':
      return []
    default:
      return state
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, [])
  // timersRef : Map(id → timeoutId). Référence stable, ne change pas
  // au re-render du Provider.
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    dispatch({ type: 'dismiss', id })
  }, [])

  const show = useCallback((content, options = {}) => {
    const id = options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = options.duration ?? 5000
    const role = options.role ?? 'status'

    // Si un toast existe déjà avec ce id, on annule son timer pour
    // repartir sur la durée pleine (ex : voiceToast déclenché 2× rapproché).
    const existingTimer = timersRef.current.get(id)
    if (existingTimer) clearTimeout(existingTimer)

    dispatch({ type: 'show', toast: { id, content, role } })

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, timer)
    }

    return id
  }, [dismiss])

  // Cleanup au démontage du Provider : annule tous les timers en cours
  // pour éviter setState après unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

// Container rendu via Portal dans `<body>` pour s'affranchir des
// stacking contexts complexes (modales, drawers, etc.). Position fixe
// bottom-center. Chaque toast gère son propre rendu (content = ReactNode).
function ToastContainer({ toasts }) {
  if (typeof document === 'undefined') return null

  // 🔴 Le container est monté EN PERMANENCE, régions vives comprises — plus de
  // `return null` quand la liste est vide. Les lecteurs d'écran n'annoncent de
  // façon fiable qu'une région live DÉJÀ PRÉSENTE au moment où son contenu
  // change : créer le `aria-live` dans le même tick que son premier toast
  // rendait les feedbacks (ajout au panier, erreurs) muets (audit 2026-08-25).
  // Deux régions permanentes, une par niveau d'urgence — un toast `alert` doit
  // interrompre, un toast `status` attend son tour.
  // ⚠️ L'ancien `aria-label` du wrapper vivait sur un div SANS rôle : interdit
  // par ARIA (`aria-prohibited-attr`), donc ignoré. Il vit désormais sur les
  // régions, qui ont un rôle.
  const groupe = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }
  const parRole = (role) => toasts
    .filter(toast => (role === 'alert') === (toast.role === 'alert'))
    .map(toast => (
      <div key={toast.id} style={{ pointerEvents: 'auto' }}>
        {toast.content}
      </div>
    ))

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(24px + var(--fp-bottom-inset, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z_INDEX.TOAST,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {/* ⚠️ `aria-live` SANS `role="status"`/`role="alert"` : une région vive
          n'a pas besoin de rôle pour être annoncée, et un `role="alert"`
          PERMANENT entrait en collision avec les alertes des formulaires —
          `getByRole('alert')` résolvait 2 éléments (attrapé par les smoke
          tests du funnel d'inscription). */}
      <div aria-live="polite" style={groupe}>
        {parRole('status')}
      </div>
      <div aria-live="assertive" aria-atomic="true" style={groupe}>
        {parRole('alert')}
      </div>
    </div>,
    document.body
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() doit être utilisé dans un <ToastProvider>')
  return ctx
}
