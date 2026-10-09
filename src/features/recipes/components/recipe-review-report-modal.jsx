import { useState } from 'react'
import { LuFlag } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import { reportReview } from '@features/recipes/api/recipe-reviews'

// Fenêtre de signalement d'un avis — sortie de `recipe-reviews-section.jsx` le
// 2026-10-05 (ce fichier franchissait 500 lignes). Déplacement à l'identique.

// Les codes que rend `reportReview`, en texte.
const MESSAGES_ERREUR = {
  max_reports_reached: (t) => t.reportMaxReports,
  account_restricted: (t) => t.reportRestricted,
}

export default function ReviewReportModal({ reviewId, userId, t, darkMode, onClose }) {
  const [reason, setReason] = useState('spam')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose })

  const reasons = [
    { key: 'spam', label: t.reportReasonSpam },
    { key: 'inappropriate', label: t.reportReasonInappropriate },
    { key: 'harassment', label: t.reportReasonHarassment },
    { key: 'wrong_info', label: t.reportReasonWrong },
    { key: 'other', label: t.reportReasonOther },
  ]

  // « Signalement envoyé » seulement s'il est parti : jusqu'au 2026-10-05 le
  // résultat n'était pas lu, et le signalement n'aboutissait jamais.
  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    let result
    try { result = await reportReview(userId, reviewId, reason) } catch { result = { error: 'failed' } }
    setSubmitting(false)
    if (result?.error) { setError(MESSAGES_ERREUR[result.error]?.(t) ?? t.reportFailed); return }
    setDone(true)
    setTimeout(onClose, 1500)
  }

  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const bg = darkMode ? '#0F1925' : '#FDFAF6'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div {...dialogue.proprietes} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', background: bg, color: fg, borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.40)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LuFlag size={18} style={{ color: '#D06060' }} />
          <h3 id={dialogue.titreId} style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{t.reportTitle}</h3>
        </div>
        {done ? (
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(123,176,120,0.12)', color: '#5A8A58', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
            ✓ {t.reportSent}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {reasons.map(r => (
                <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', border: `1px solid ${reason === r.key ? 'var(--color-brand-500)' : border}`, background: reason === r.key ? 'rgba(224,120,32,0.08)' : 'transparent', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} style={{ accentColor: 'var(--color-brand-500)' }} />
                  {r.label}
                </label>
              ))}
            </div>
            {error && (
              <p role="alert" style={{ margin: 0, fontSize: '12px', color: '#D06060', padding: '6px 10px', borderRadius: '6px', background: 'rgba(208,96,96,0.10)' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="secondary"
                onClick={onClose}
                type="button"
                className="h-auto rounded-lg border-[1.5px] bg-transparent px-3.5 py-1.5 text-xs font-semibold"
                style={{ borderColor: border, color: muted }}>
                {t.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                type="button"
                loading={submitting}
                disabled={submitting}
                className="h-auto rounded-lg bg-[#D06060] px-3.5 py-1.5 text-xs font-bold text-white">
                {t.reportSubmit}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
