import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LuFlag } from 'react-icons/lu'
import { reportPost, reportReply, reportProfile } from '@shared/api/community'
import { COMMUNITY_I18N, REPORT_REASONS, reportReasonLabel } from '@shared/lib/i18n/community-i18n'
import Button from '@shared/ui/button'

// Modale de signalement réutilisable post + reply. Partagée entre usage
// autonome (community-page.jsx) et usage imbriqué (community-profile-modal.jsx,
// qui gère lui-même le bouton retour via une seule entrée d'historique
// partagée — cf. son commentaire) : PAS de useCloseOnBackButton ici, ce
// serait dupliqué pour l'usage imbriqué et casserait sa logique de bascule
// (fermer via X/Annuler y déclencherait un history.back() de trop qui
// fermerait aussi la modale profil englobante). Câblé à l'appelant à la
// place — cf. community-page.jsx et community-profile-modal.jsx.
// Insère un ticket dans support_tickets via lib/db/community.

export default function ReportModal({ targetType, targetId, userId, lang = 'fr', darkMode = false, onClose, zIndex = 70 }) {
  const t = COMMUNITY_I18N[lang] ?? COMMUNITY_I18N.fr
  const [reason, setReason] = useState('spam')
  const [context, setContext] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!userId) { setError(t.loginToPost); return }
    setSubmitting(true)
    setError(null)
    let result
    if (targetType === 'community_post') {
      result = await reportPost(userId, targetId, reason, context)
    } else if (targetType === 'community_reply') {
      result = await reportReply(userId, targetId, reason, context)
    } else if (targetType === 'community_profile') {
      result = await reportProfile(userId, targetId, reason, context)
    } else {
      setSubmitting(false)
      setError('invalid_target')
      return
    }
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    setDone(true)
    setTimeout(onClose, 1500)
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const bg = darkMode ? '#0F1925' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const inputBg = darkMode ? '#131E2C' : '#FFFFFF'

  // createPortal vers document.body : sans ça la modale est
  // contrainte par le containing block du parent (CommunityPanel a un
  // backdrop-filter qui crée un nouveau containing block pour position:fixed).
  return createPortal(
    <div onClick={onClose}
      className="fp-modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '460px', background: bg, color: fg, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.40)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LuFlag size={18} style={{ color: '#D06060' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{t.reportTitle}</h3>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: muted, lineHeight: 1.4 }}>{t.reportSub}</p>

        {!done ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.reportReason}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {REPORT_REASONS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', border: `1px solid ${reason === r ? 'var(--color-brand-500)' : border}`, background: reason === r ? 'rgba(224,120,32,0.08)' : 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: 'var(--color-brand-500)' }} />
                    {reportReasonLabel(t, r)}
                  </label>
                ))}
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.reportContext}</span>
              <textarea value={context} onChange={e => setContext(e.target.value)} placeholder={t.reportContextPh} maxLength={500} rows={3}
                style={{ padding: '10px 12px', borderRadius: '8px', border: `1.5px solid ${border}`, background: inputBg, color: fg, fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>

            {error && <div style={{ fontSize: '12px', color: '#D06060', padding: '6px 10px', borderRadius: '6px', background: 'rgba(208,96,96,0.10)' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="secondary"
                onClick={onClose}
                type="button"
                className="h-auto rounded-lg border-[1.5px] bg-transparent px-3.5 py-2 text-[13px] font-semibold"
                style={{ borderColor: border, color: muted }}>
                {t.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                type="button"
                loading={submitting}
                disabled={submitting}
                className="h-auto rounded-lg bg-[#D06060] px-4 py-2 text-[13px] font-bold text-white">
                {t.reportSubmit}
              </Button>
            </div>
          </>
        ) : (
          <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(123,176,120,0.12)', color: '#5A8A58', fontSize: '14px', fontWeight: 600, textAlign: 'center' }}>
            ✓ {t.reportSent}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
