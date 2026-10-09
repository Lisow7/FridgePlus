import { useState, useId } from 'react'
import { LuTriangle, LuTrash2, LuLock, LuEye, LuEyeOff, LuChevronDown } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'

// Phase 7 launch (refonte Profil) — sous-composant extrait de
// ProfileModal lors de la PR 8.6.1.b. Pure presentational : reçoit l'état
// + callbacks du parent (état dialog, password, loading, onSubmit).
//
// Affiche : section "Zone de danger" rouge dans l'onglet Confidentialité,
// + mini-dialog modale de confirmation avec saisie mot de passe.

export default function DangerZone({
  // État + callbacks
  isDialogOpen,            // boolean
  onOpenDialog,            // () => void  — ouvre le dialog (reset state au passage)
  onCloseDialog,           // () => void  — ferme le dialog
  password,                // string
  onPasswordChange,        // (value) => void
  showPassword,            // boolean
  onTogglePasswordVisibility, // () => void
  isLoading,               // boolean
  onSubmit,                // (event) => Promise<void>
  error = null,            // message à dire DANS la fenêtre (CPT-04 : il s'écrivait derrière le fond flouté)
  // i18n + styles partagés
  t,                       // i18n object (dangerTitle, dangerText, dangerBtn, dangerConfirm, cancelBtn, tabDanger)
  lang,
  isMobile,
  darkMode,
  border,
  textColor,
  mutedColor,
  modalBg,
  iconStyle,               // style pour LuLock (positionné absolute dans input)
  inputStyle,              // style de base de l'input password
  pwdToggleLabel,          // (lang, isShown) => string — aria-label du bouton œil
  collapsible = false,     // Sprint 11 — pliable dans la page Compte
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose: onCloseDialog, actif: isDialogOpen })
  const champMotDePasseId = useId()
  return (
    <>
      {/* ─── Section Zone de danger (visible dans l'onglet Confidentialité) ─── */}
      <section style={{
        padding: isMobile ? '14px' : '16px',
        borderRadius: '12px',
        border: '1.5px solid rgba(239,68,68,0.30)',
        background: darkMode ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {/* Dépliable : un VRAI bouton dans le titre, comme `ProfileSection`
            (audit A11Y-19 : un `role="button"` contenait le titre, et ce
            titre sautait du niveau 2 au niveau 4). */}
        <div
          onClick={collapsible ? () => setOpen((v) => !v) : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: collapsible ? 'pointer' : undefined,
            userSelect: collapsible ? 'none' : undefined,
          }}
        >
          <span style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#ef4444',
            color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LuTriangle size={15} />
          </span>
          <h2 style={{
            margin: 0, fontSize: isMobile ? '14px' : '15px',
            fontWeight: 800, color: '#ef4444', flex: 1,
          }}>
            {collapsible ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
                style={{ background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                {t.dangerTitle ?? t.tabDanger ?? 'Zone de danger'}
              </button>
            ) : (t.dangerTitle ?? t.tabDanger ?? 'Zone de danger')}
          </h2>
          {collapsible && (
            <span aria-hidden="true" style={{
              display: 'inline-flex',
              transition: 'transform 0.18s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: '#ef4444',
            }}>
              <LuChevronDown size={18} />
            </span>
          )}
        </div>

        {(!collapsible || open) && (
          <>
            <p style={{
              margin: 0, fontSize: isMobile ? '12px' : '13px',
              color: mutedColor, lineHeight: 1.55,
            }}>
              {t.dangerText}
            </p>
            <Button
              type="button"
              onClick={onOpenDialog}
              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ef4444' }}
              className="h-auto self-start rounded-[10px] bg-[#ef4444] text-sm font-bold text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
              style={{
                gap: '8px',
                padding: isMobile ? '9px 14px' : '10px 16px',
                fontSize: isMobile ? '13px' : '14px',
                transition: 'background 0.15s',
              }}
            >
              {t.dangerBtn}
            </Button>
          </>
        )}
      </section>

      {/* ─── Mini-dialog de confirmation suppression compte ─── */}
      {isDialogOpen && (
        <div
          onClick={onCloseDialog}
          className="fp-modal-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(18,10,4,0.65)', backdropFilter: 'blur(6px)',
            padding: '16px',
          }}
        >
          <div
            {...dialogue.proprietes}
            onClick={e => e.stopPropagation()}
            className="fp-modal-panel"
            style={{
              width: '460px', maxWidth: '100%',
              background: modalBg,
              borderRadius: '20px',
              border: '1.5px solid rgba(239,68,68,0.35)',
              padding: '22px',
              display: 'flex', flexDirection: 'column', gap: '14px',
              boxShadow: darkMode ? '0 16px 48px rgba(0,0,0,0.65)' : '0 16px 48px rgba(0,0,0,0.20)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <LuTriangle size={18} />
              </span>
              <h3 id={dialogue.titreId} style={{ fontSize: '17px', fontWeight: 800, color: '#ef4444', margin: 0 }}>{t.dangerTitle}</h3>
            </div>
            <p style={{ fontSize: '14px', color: mutedColor, lineHeight: 1.6, margin: 0 }}>{t.dangerText}</p>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Un libellé visible (décision du 2026-10-06) ; pas d'exemple
                  pour un mot de passe. */}
              <label htmlFor={champMotDePasseId} style={{ fontSize: '12px', fontWeight: 700, color: mutedColor, marginBottom: '-4px' }}>{t.dangerConfirm}</label>
              <div style={{ position: 'relative' }}>
                <LuLock size={15} style={iconStyle} />
                <input
                  id={champMotDePasseId}
                  type={showPassword ? 'text' : 'password'} required
                  value={password} onChange={e => onPasswordChange(e.target.value)}
                  autoFocus
                  style={{ ...inputStyle, paddingRight: '36px', borderColor: 'rgba(239,68,68,0.35)' }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  aria-label={pwdToggleLabel(lang, showPassword)}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 h-auto w-auto -translate-y-1/2 bg-transparent p-0 hover:bg-transparent"
                  style={{ color: mutedColor }}
                >
                  {showPassword ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                </Button>
              </div>
              {error && (
                <p role="alert" style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: darkMode ? '#F59B9B' : '#B42318' }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={onCloseDialog}
                  className="h-auto flex-1 rounded-[10px] border-[1.5px] bg-transparent px-3 py-3 text-sm font-semibold"
                  style={{ borderColor: border, color: textColor }}
                >
                  {t.cancelBtn}
                </Button>
                <Button
                  type="submit"
                  loading={isLoading}
                  disabled={isLoading || !password}
                  className="h-auto flex-1 rounded-[10px] bg-[#ef4444] px-3 py-3 text-sm font-bold text-white"
                  style={{ gap: '6px' }}
                >
                  {!isLoading && <LuTrash2 size={14} />}
                  {t.dangerBtn}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
