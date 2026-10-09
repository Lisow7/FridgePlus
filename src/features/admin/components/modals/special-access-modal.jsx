import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuFlaskConical, LuHeadphones, LuStar, LuHandshake, LuShieldPlus, LuShieldMinus } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'

const ROLES = [
  { value: 'tester',     Icon: LuFlaskConical, fr: 'Bêta-testeur',       en: 'Beta tester',      color: '#6B7280' },
  { value: 'support',    Icon: LuHeadphones,   fr: 'Équipe support',      en: 'Support team',     color: '#3B82F6' },
  { value: 'influencer', Icon: LuStar,         fr: 'Créateur partenaire', en: 'Partner creator',  color: '#8B5CF6' },
  { value: 'partner',    Icon: LuHandshake,    fr: 'Partenaire Fridge+',  en: 'Fridge+ Partner',  color: '#D46A10' },
]

export default function SpecialAccessModal({ darkMode, username, currentRole, onConfirmGrant, onConfirmRevoke, onCancel }) {
  const [selectedRole, setSelectedRole] = useState(currentRole ?? 'tester')
  const [note, setNote]                 = useState('')

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  }
  const card = {
    background: darkMode ? '#1A2535' : '#FFFFFF',
    borderRadius: '16px', padding: '24px',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex', flexDirection: 'column', gap: '18px',
  }
  const fg   = darkMode ? '#F0E8DC' : '#2C1A0E'
  const muted = darkMode ? 'rgba(240,232,220,0.55)' : 'rgba(44,26,14,0.55)'

  const isGrantMode = !currentRole

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onCancel })
  useCloseOnBackButton(true, onCancel)

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="special-access-title" style={overlay} onClick={onCancel}>
      <div ref={dialogRef} style={card} onClick={e => e.stopPropagation()}>
        <h2 id="special-access-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: fg, display: 'flex', alignItems: 'center', gap: 8 }}>
          {isGrantMode ? <LuShieldPlus size={17} /> : <LuShieldMinus size={17} />}
          {isGrantMode ? `Accès spécial — ${username}` : `Révoquer — ${username}`}
        </h2>

        {isGrantMode ? (
          <>
            {/* Sélecteur de rôle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rôle</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ROLES.map((role) => {
                  const RoleIcon = role.Icon
                  return (
                    <button
                      key={role.value}
                      onClick={() => setSelectedRole(role.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', borderRadius: '10px', border: 'none',
                        background: selectedRole === role.value
                          ? `${role.color}22`
                          : (darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                        outline: selectedRole === role.value ? `2px solid ${role.color}` : '2px solid transparent',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        color: selectedRole === role.value ? role.color : fg,
                        fontWeight: 600, fontSize: '13px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <RoleIcon size={15} />
                      {role.fr}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Note interne */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Note interne <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel — admin uniquement)</span>
              </span>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex : Deal Instagram @machin, mai 2026"
                rows={2}
                maxLength={500}
                style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1.5px solid',
                  borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                  background: darkMode ? 'rgba(255,255,255,0.04)' : '#FAFAFA',
                  color: fg, fontSize: '13px', resize: 'vertical',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
              <Button
                size="sm"
                onClick={() => onConfirmGrant(selectedRole, note.trim() || null)}
                style={{ background: 'var(--gradient-warm)', color: '#2C1A0E', fontWeight: 700 }}
              >
                <LuShieldPlus size={13} />
                Accorder
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.6 }}>
              {username} perdra son accès spécial. Si son abonnement Stripe était encore actif avant l&apos;attribution, il sera restauré automatiquement.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
              <Button
                size="sm"
                onClick={onConfirmRevoke}
                style={{ background: 'rgba(220,38,38,0.12)', color: '#DC2626', fontWeight: 700 }}
              >
                <LuShieldMinus size={13} />
                Révoquer
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
