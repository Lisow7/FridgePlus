import { LuStar, LuX } from 'react-icons/lu'
import { CIBLE_MINIMALE } from '@shared/lib/cible-minimale'

const I18N = {
  fr: { title: 'Comment c\'était ?', close: 'Fermer' },
  en: { title: 'How was it?', close: 'Close' },
}

// Toast de notation rapide 1-tap, montré par `hooks/use-quick-rate-prompt.jsx`
// après un « J'ai cuisiné » réussi. Ses six boutons sont bruts (hors <Button>) :
// ils portent la taille minimale de 24 px en style (audit du 2026-10-04, A11Y-13).
export default function QuickRateToast({ lang, onRate, onDismiss }) {
  const t = I18N[lang] ?? I18N.fr
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', borderRadius: '12px',
      background: '#B85000', color: '#fff',
      boxShadow: '0 6px 20px rgba(224,120,32,0.35)', maxWidth: '320px',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{t.title}</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onRate(n)}
            aria-label={`${n}/5`}
            style={{ ...CIBLE_MINIMALE, background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#fff' }}>
            <LuStar size={18} fill="none" strokeWidth={2.2} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onDismiss} aria-label={t.close}
        style={{ ...CIBLE_MINIMALE, background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#fff', opacity: 0.7, flexShrink: 0 }}>
        <LuX size={16} />
      </button>
    </div>
  )
}
