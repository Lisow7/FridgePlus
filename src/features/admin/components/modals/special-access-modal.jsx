import { useState, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuFlaskConical, LuHeadphones, LuStar, LuHandshake, LuShieldPlus, LuShieldMinus, LuPencil } from 'react-icons/lu'
import { useFocusTrap } from '@shared/hooks/use-focus-trap'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { messageErreurAdmin } from '@features/admin/lib/ecritures-admin'
import Button from '@shared/ui/button'

const ROLES = [
  { value: 'tester',     Icon: LuFlaskConical, fr: 'Bêta-testeur',      color: '#6B7280' },
  { value: 'support',    Icon: LuHeadphones,   fr: 'Équipe support',     color: '#3B82F6' },
  { value: 'influencer', Icon: LuStar,         fr: 'Créateur partenaire',  color: '#8B5CF6' },
  { value: 'partner',    Icon: LuHandshake,    fr: 'Partenaire Fridge+',  color: '#D46A10' },
]

// Trois modes (audit du 2026-10-04, ADM-13) : accorder (aucun rôle), retirer
// (un rôle), modifier (changer de rôle ou de note SANS révoquer —
// `grant_special_access` met à jour rôle et note et garde l'état Stripe
// d'avant l'attribution). Une seule demande à la fois, et son refus dit ici :
// un double clic envoyait deux demandes, un échec laissait la fenêtre muette.
// `onConfirmGrant` / `onConfirmRevoke` rendent `{ error }` ; la section ferme
// la fenêtre sur un succès. `lireLaNote` rend `{ note, error }`.
export default function SpecialAccessModal({ darkMode, username, currentRole, onConfirmGrant, onConfirmRevoke, onCancel, lireLaNote }) {
  const [mode, setMode]                 = useState(currentRole ? 'retirer' : 'accorder')
  const [selectedRole, setSelectedRole] = useState(currentRole ?? 'tester')
  const [note, setNote]                 = useState('')
  const [occupe, setOccupe]             = useState(false)
  const [erreur, setErreur]             = useState(null)
  const enCours = useRef(false)
  const noteId = useId()

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

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, { active: true, onEscape: onCancel })
  useCloseOnBackButton(true, onCancel)

  async function envoyer(action) {
    if (enCours.current) return
    enCours.current = true
    setOccupe(true); setErreur(null)
    const resultat = await action()
    if (resultat?.error) {
      setErreur(messageErreurAdmin(resultat.error, 'fr'))
      enCours.current = false
      setOccupe(false)
    }
  }

  async function passerEnModification() {
    setMode('modifier'); setErreur(null)
    const { note: actuelle, error } = await lireLaNote()
    if (error) setErreur(`La note actuelle n'a pas pu être lue (${messageErreurAdmin(error, 'fr')}) : elle sera remplacée par ce que tu écris.`)
    else setNote(actuelle ?? '')
  }

  const titre = mode === 'accorder' ? `Accès spécial — ${username}` : mode === 'modifier' ? `Modifier — ${username}` : `Révoquer — ${username}`
  const IconeTitre = mode === 'accorder' ? LuShieldPlus : mode === 'modifier' ? LuPencil : LuShieldMinus

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="special-access-title" style={overlay} onClick={onCancel}>
      <div ref={dialogRef} style={card} onClick={e => e.stopPropagation()}>
        <h2 id="special-access-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: fg, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconeTitre size={17} />
          {titre}
        </h2>

        {mode !== 'retirer' ? (
          <>
            <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.6 }}>
              {mode === 'accorder'
                ? `${username} aura le Premium offert, sans échéance, jusqu'à ce que tu retires l'accès. S'il a un abonnement Stripe actif, il lui sera rendu au retrait.`
                : `Le rôle et la note changent ; le Premium offert continue, et l'abonnement Stripe d'avant l'attribution reste gardé pour le retrait.`}
            </p>

            {/* Sélecteur de rôle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rôle</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ROLES.map((role) => {
                  const RoleIcon = role.Icon
                  return (
                    <button
                      key={role.value}
                      type="button"
                      aria-pressed={selectedRole === role.value}
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
              {/* Le titre écrit au-dessus EST le libellé du champ (décision du 2026-10-06). */}
              <label htmlFor={noteId} style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Note interne <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel — admin uniquement{mode === 'modifier' ? ', vide pour l\'effacer' : ''})</span>
              </label>
              <textarea
                id={noteId}
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

            {erreur && <p role="alert" style={{ margin: 0, fontSize: '13px', color: 'var(--color-danger)' }}>{erreur}</p>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
              <Button
                size="sm"
                onClick={() => envoyer(() => onConfirmGrant(selectedRole, note.trim() || null))}
                disabled={occupe}
                loading={occupe}
                style={{ background: 'var(--gradient-warm)', color: '#2C1A0E', fontWeight: 700 }}
              >
                {mode === 'accorder' ? <LuShieldPlus size={13} /> : <LuPencil size={13} />}
                {mode === 'accorder' ? 'Accorder' : 'Enregistrer'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.6 }}>
              {username} perdra son accès spécial. Si son abonnement Stripe était encore actif avant l&apos;attribution, il sera restauré automatiquement.
            </p>
            {erreur && <p role="alert" style={{ margin: 0, fontSize: '13px', color: 'var(--color-danger)' }}>{erreur}</p>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
              <Button variant="ghost" size="sm" onClick={passerEnModification} disabled={occupe}>
                Modifier le rôle ou la note
              </Button>
              <Button
                size="sm"
                onClick={() => envoyer(onConfirmRevoke)}
                disabled={occupe}
                loading={occupe}
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
