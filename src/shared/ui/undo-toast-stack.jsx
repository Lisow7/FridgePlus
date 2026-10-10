import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuRotateCcw } from 'react-icons/lu'

// Stack de toasts d'annulation.
// Affiché en bas de l'écran (centré horizontalement), au-dessus de toutes
// les modales (z-index élevé). Limité à 3 toasts visibles simultanément
// (cf. UndoProvider qui flush l'ancien quand on en ajoute un 4e).

const I18N = {
 fr: { undo: 'Annuler', undoAria: 'Annuler la suppression', regionAria: "Notifications d'annulation" },
 en: { undo: 'Undo', undoAria: 'Undo deletion', regionAria: 'Undo notifications' },
}

export default function UndoToastStack({ stack, onUndo, onPause = () => {}, onResume = () => {}, lang = 'fr', darkMode = false }) {
 const t = I18N[lang] ?? I18N.fr
 if (!stack || stack.length === 0) return null
 return createPortal(
 <div
 role="region"
 aria-live="polite"
 aria-label={t.regionAria}
 style={{
 position: 'fixed',
 bottom: 'calc(24px + var(--fp-bottom-inset, 0px))',
 left: '50%',
 transform: 'translateX(-50%)',
 zIndex: 10100,
 display: 'flex',
 flexDirection: 'column',
 gap: 8,
 pointerEvents: 'none',
 maxWidth: '92vw',
 }}
 >
 {stack.map(toast => (
 <UndoToast
 key={toast.id}
 toast={toast}
 onUndo={onUndo}
 onPause={onPause}
 onResume={onResume}
 lang={lang}
 darkMode={darkMode}
 />
 ))}
 </div>,
 document.body,
 )
}

function UndoToast({ toast, onUndo, onPause, onResume, lang, darkMode }) {
 const t = I18N[lang] ?? I18N.fr
 // La durée demandée au déclenchement (10 s par défaut) : la barre était calée
 // sur 10 000 en dur, fausse pour toute autre durée (A11Y-12).
 const totalMs = toast.durationMs ?? 10000
 const [progress, setProgress] = useState(1)
 // En pause, le temps restant ne bouge plus : la barre non plus — sa valeur se
 // lit au rendu, et la boucle d'animation s'arrête.
 const enPause = toast.pauseAt != null
 const progressFige = enPause ? Math.max(0, toast.expireAt - toast.pauseAt) / totalMs : null

 useEffect(() => {
 if (enPause) return undefined
 let raf
 const tick = () => {
 const remaining = Math.max(0, toast.expireAt - Date.now())
 setProgress(remaining / totalMs)
 if (remaining > 0) raf = requestAnimationFrame(tick)
 }
 raf = requestAnimationFrame(tick)
 return () => cancelAnimationFrame(raf)
 }, [toast.expireAt, enPause, totalMs])

 const bg = darkMode ? '#0F1925' : '#2C1A0E'
 const fg = darkMode ? 'var(--color-bg-warm)' : 'var(--color-bg-warm)'
 const accent = 'var(--color-brand-500)'

 return (
 <div
 role="status"
 onMouseEnter={() => onPause(toast.id, 'souris')}
 onMouseLeave={() => onResume(toast.id, 'souris')}
 onFocus={() => onPause(toast.id, 'focus')}
 onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onResume(toast.id, 'focus') }}
 style={{
 pointerEvents: 'auto',
 background: bg,
 color: fg,
 borderRadius: 10,
 padding: '12px 16px',
 minWidth: 280,
 maxWidth: 420,
 boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
 border: `1px solid ${darkMode ? 'var(--color-dark-surface)' : '#3D2A1B'}`,
 display: 'flex',
 flexDirection: 'column',
 gap: 8,
 animation: 'undo-slide-in 0.18s ease both',
 }}
 >
 <style>{`
 @keyframes undo-slide-in {
 from { opacity: 0; transform: translateY(8px); }
 to { opacity: 1; transform: translateY(0); }
 }
 `}</style>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
 <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, flex: 1 }}>
 {toast.label}
 </span>
 <button
 onClick={() => onUndo(toast.id)}
 aria-label={t.undoAria}
 style={{
 display: 'inline-flex',
 alignItems: 'center',
 gap: 6,
 background: 'transparent',
 border: `1px solid ${accent}`,
 color: accent,
 padding: '6px 12px',
 borderRadius: 6,
 fontSize: 12,
 fontWeight: 700,
 cursor: 'pointer',
 fontFamily: 'inherit',
 flexShrink: 0,
 transition: 'background 0.15s, color 0.15s',
 }}
 onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff' }}
 onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accent }}
 >
 <LuRotateCcw size={14} />
 {t.undo}
 </button>
 </div>
 {/* Countdown bar : largeur proportionnelle au temps restant */}
 <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
 <div
 data-barre
 style={{
 height: '100%',
 width: `${Math.round((progressFige ?? progress) * 100)}%`,
 background: accent,
 transition: 'width 0.05s linear',
 }}
 />
 </div>
 </div>
 )
}
