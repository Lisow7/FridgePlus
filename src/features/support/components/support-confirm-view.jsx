import Button from '@shared/ui/button'

/**
 * Vue « récapitulatif » du panneau Support : dernier écran avant envoi.
 *
 * Même contrat que SupportFormView : l'état arrive en UN objet (`ctx`).
 */
export default function SupportConfirmView({ ctx, theme, t }) {
  const { newFlow, error, setError, sending, handleSubmit, setView } = ctx
  const { border, text, muted, rowBg } = theme

  const { category, target, reasonKey, details, freeTitle } = newFlow
  if (!category) return null
  const rKey = category.fixedReason ?? reasonKey

  return (
    <div style={{ padding:'16px 18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
      {error && <p style={{ fontSize:12, color:'var(--color-danger)', margin:0 }}>{error}</p>}

      <div style={{ borderRadius:12, border:`1px solid ${border}`, background:rowBg, overflow:'hidden' }}>
        {/* Catégorie */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderBottom:`1px solid ${border}` }}>
          <span style={{ fontSize:10, fontWeight:700, color:muted, letterSpacing:'0.08em', textTransform:'uppercase', width:80, flexShrink:0 }}>{t.confirmCat}</span>
          <span style={{ fontSize:13, fontWeight:600, color:text }}>{category.emoji} {t.cats[category.id]}</span>
        </div>
        {/* Cible */}
        {target && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderBottom:`1px solid ${border}` }}>
            <span style={{ fontSize:10, fontWeight:700, color:muted, letterSpacing:'0.08em', textTransform:'uppercase', width:80, flexShrink:0 }}>{t.confirmTarget}</span>
            <span style={{ fontSize:13, color:text }}>{target.emoji} {target.label}</span>
          </div>
        )}
        {/* Raison */}
        {rKey && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderBottom:`1px solid ${border}` }}>
            <span style={{ fontSize:10, fontWeight:700, color:muted, letterSpacing:'0.08em', textTransform:'uppercase', width:80, flexShrink:0 }}>{t.confirmReason}</span>
            <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'rgba(212,106,16,0.10)', color:'var(--color-warm-600)' }}>{t.reasons[rKey] ?? rKey}</span>
          </div>
        )}
        {/* Titre libre */}
        {category.flow === 'free' && freeTitle.trim() && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 16px', borderBottom:`1px solid ${border}` }}>
            <span style={{ fontSize:10, fontWeight:700, color:muted, letterSpacing:'0.08em', textTransform:'uppercase', width:80, flexShrink:0, paddingTop:1 }}>{t.freeTitleLabel}</span>
            <span style={{ fontSize:13, color:text }}>{freeTitle.trim()}</span>
          </div>
        )}
        {/* Message */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 16px' }}>
          <span style={{ fontSize:10, fontWeight:700, color:muted, letterSpacing:'0.08em', textTransform:'uppercase', width:80, flexShrink:0, paddingTop:1 }}>{t.confirmDetails}</span>
          <span style={{ fontSize:13, color:details.trim() ? text : muted, fontStyle:details.trim() ? 'normal' : 'italic', lineHeight:1.5, whiteSpace:'pre-wrap', overflowWrap:'break-word' }}>
            {details.trim() || t.noDetails}
          </span>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <Button
          variant="ghost"
          onClick={() => { setError(null); setView('form') }}
          className="h-auto rounded-[10px] border-[1.5px] bg-transparent px-[18px] py-2.5 text-[13px] font-medium hover:bg-transparent"
          style={{ borderColor: border, color: text }}>
          {t.back}
        </Button>
        <Button
          onClick={handleSubmit}
          loading={sending}
          disabled={sending}
          className="h-auto rounded-[10px] px-6 py-2.5 text-[13px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#2E4A6A,#1A2F48)' }}>
          {t.submit}
        </Button>
      </div>
    </div>
  )
}
