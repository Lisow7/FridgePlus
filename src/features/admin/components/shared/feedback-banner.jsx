import { LuCircleCheck, LuTriangleAlert } from 'react-icons/lu'

// Bandeau de feedback admin unifié (Vague A — fondations). Remplace les bandeaux
// dupliqués des sections. Normalise les deux formes historiques :
//   { ok: bool, msg } (recettes/ingrédients)  et  { type:'error'|…, text } (communauté/avis).
export default function FeedbackBanner({ feedback }) {
  if (!feedback) return null
  const ok = feedback.ok ?? (feedback.type !== 'error')
  const msg = feedback.msg ?? feedback.text ?? ''
  // Annoncé aux lecteurs d'écran : poli pour un succès, aussitôt pour un échec.
  return (
    <div role={ok ? 'status' : 'alert'} style={{
      marginBottom: 10, padding: '10px 14px', borderRadius: 10,
      background: ok ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${ok ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
      color: ok ? 'var(--color-success)' : 'var(--color-danger)',
      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
    }}>
      {ok ? <LuCircleCheck size={14} /> : <LuTriangleAlert size={14} />}
      <span>{msg}</span>
    </div>
  )
}
