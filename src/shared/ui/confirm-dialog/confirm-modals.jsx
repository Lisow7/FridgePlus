import { useRef } from 'react'
import { LuTriangleAlert, LuSparkles } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { Z_INDEX } from '@shared/lib/z-index'
import Button from '@shared/ui/button'

// a11y : focus trap + Escape + aria-labelledby (Sprint 2 PR S2.d).
// Avant : `role="dialog"` + `aria-modal="true"` mais aucun piège de focus
// ni gestion clavier — utilisateurs clavier coincés. Le `aria-labelledby`
// pointe vers le <h2> qui est désormais identifié par un id stable.
//
// Déplacé de features/admin/ vers shared/ui/ (2026-07-18) : réutilisé par
// useConfirm() pour remplacer confirm() natif dans 14 fichiers hors admin.
// `body` optionnel : la majorité des sites confirm() natifs n'ont qu'un
// message unique (pas de split titre/body).

export function ConfirmDeleteModal({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel, darkMode }) {
  const bg     = darkMode ? '#0F1925' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const danger = 'var(--color-danger)'
  const ref = useRef(null)
  useFocusTrap(ref, { active: true, onEscape: onCancel })
  useCloseOnBackButton(true, onCancel)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:Z_INDEX.CONFIRM, background:'rgba(15,8,2,0.78)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div ref={ref} onClick={e => e.stopPropagation()}
        style={{ background:bg, color:fg, borderRadius:14, maxWidth:460, width:'100%', border:`2px solid ${danger}33`, boxShadow:'0 24px 64px rgba(0,0,0,0.4)', padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <LuTriangleAlert size={22} color={danger} />
          <h2 id="confirm-delete-title" style={{ fontSize:17, fontWeight:800, margin:0, color:danger }}>{title}</h2>
        </div>
        {body && <p style={{ margin:'0 0 22px', fontSize:14, lineHeight:1.55 }}>{body}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap', marginTop: body ? 0 : 18 }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className="h-auto rounded-lg px-[18px] py-2.5 text-[13px] font-bold text-white"
            style={{ background: danger }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmActionModal({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel, darkMode }) {
  const bg     = darkMode ? '#0F1925' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const accent = 'var(--color-brand-500)'
  const ref = useRef(null)
  useFocusTrap(ref, { active: true, onEscape: onCancel })
  useCloseOnBackButton(true, onCancel)
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-action-title" onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:Z_INDEX.CONFIRM, background:'rgba(15,8,2,0.78)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div ref={ref} onClick={e => e.stopPropagation()}
        style={{ background:bg, color:fg, borderRadius:14, maxWidth:460, width:'100%', border:`2px solid ${accent}33`, boxShadow:'0 24px 64px rgba(0,0,0,0.4)', padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <LuSparkles size={22} color={accent} />
          <h2 id="confirm-action-title" style={{ fontSize:17, fontWeight:800, margin:0, color:accent }}>{title}</h2>
        </div>
        {body && <p style={{ margin:'0 0 22px', fontSize:14, lineHeight:1.55 }}>{body}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap', marginTop: body ? 0 : 18 }}>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="h-auto rounded-lg border bg-transparent px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderColor: border, color: fg }}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className="h-auto rounded-lg px-[18px] py-2.5 text-[13px] font-bold text-white"
            style={{ background: accent }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
