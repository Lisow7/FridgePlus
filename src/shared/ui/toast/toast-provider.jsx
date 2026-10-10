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
  // timersRef : Map(id → { minuteur, expireAt, resteMs, retenuPar }). Référence
  // stable, ne change pas au re-render du Provider. `resteMs` n'existe que
  // pendant une pause ; `retenuPar` dit qui la tient (souris, focus).
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    const entree = timersRef.current.get(id)
    if (entree) {
      clearTimeout(entree.minuteur)
      timersRef.current.delete(id)
    }
    dispatch({ type: 'dismiss', id })
  }, [])

  const armer = useCallback((id, delai) => {
    const minuteur = setTimeout(() => dismiss(id), delai)
    timersRef.current.set(id, { minuteur, expireAt: Date.now() + delai, resteMs: null, retenuPar: new Set() })
  }, [dismiss])

  // WCAG 2.2.1 : un message qui part tout seul attend qui le lit. Sous la souris
  // ou avec le focus dedans, le minuteur se met en pause ; il repart avec le temps
  // restant (une seconde au moins) quand plus rien ne le retient. Un toast sans
  // minuteur (duration 0) n'est pas concerné (audit du 2026-10-04, A11Y-12).
  const pause = useCallback((id, cause) => {
    const entree = timersRef.current.get(id)
    if (!entree) return
    entree.retenuPar.add(cause)
    if (entree.resteMs != null) return
    clearTimeout(entree.minuteur)
    entree.resteMs = Math.max(0, entree.expireAt - Date.now())
  }, [])

  const resume = useCallback((id, cause) => {
    const entree = timersRef.current.get(id)
    if (!entree || entree.resteMs == null) return
    entree.retenuPar.delete(cause)
    if (entree.retenuPar.size > 0) return
    armer(id, Math.max(entree.resteMs, 1000))
  }, [armer])

  const show = useCallback((content, options = {}) => {
    const id = options.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = options.duration ?? 5000
    const role = options.role ?? 'status'

    // Si un toast existe déjà avec ce id, on annule son timer pour
    // repartir sur la durée pleine (ex : voiceToast déclenché 2× rapproché).
    const existante = timersRef.current.get(id)
    if (existante) {
      clearTimeout(existante.minuteur)
      timersRef.current.delete(id)
    }

    dispatch({ type: 'show', toast: { id, content, role } })

    if (duration > 0) armer(id, duration)

    return id
  }, [armer])

  // Cleanup au démontage du Provider : annule tous les timers en cours
  // pour éviter setState après unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const entree of timers.values()) clearTimeout(entree.minuteur)
      timers.clear()
    }
  }, [])

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  )
}

// Container rendu via Portal dans `<body>` pour s'affranchir des
// stacking contexts complexes (modales, drawers, etc.). Position fixe
// bottom-center. Chaque toast gère son propre rendu (content = ReactNode).
function ToastContainer({ toasts, onPause, onResume }) {
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
      <div
        key={toast.id}
        style={{ pointerEvents: 'auto' }}
        onMouseEnter={() => onPause(toast.id, 'souris')}
        onMouseLeave={() => onResume(toast.id, 'souris')}
        onFocus={() => onPause(toast.id, 'focus')}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onResume(toast.id, 'focus') }}
      >
        {toast.content}
      </div>
    ))

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(24px + var(--fp-bottom-inset, 0px))',
        // Ancré aux deux bords et centré par flexbox — PAS `left: 50%` +
        // `translateX(-50%)` : placé ainsi, le contenu ne dispose que d'une
        // demi-fenêtre, et sur téléphone un message d'une phrase s'écrivait
        // dans une colonne de 60 px (vu le 2026-10-05). Les clics traversent
        // toujours la zone vide (`pointerEvents: 'none'`).
        left: '16px',
        right: '16px',
        zIndex: Z_INDEX.TOAST,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none',
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
