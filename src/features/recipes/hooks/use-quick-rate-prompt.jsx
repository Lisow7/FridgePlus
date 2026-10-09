import { useCallback } from 'react'
import { LuStar, LuX } from 'react-icons/lu'
import { useToast } from '@shared/ui/toast/toast-provider'
import { getMyReview, upsertReview } from '@features/recipes/api/recipe-reviews'

const I18N = {
  fr: { title: 'Comment c\'était ?', close: 'Fermer' },
  en: { title: 'How was it?', close: 'Close' },
}

// Toast de notation rapide 1-tap, affiché après un `logCooking()` réussi
// (cf. recipe-modal.jsx). `duration: 0` = pas d'auto-dismiss (contrairement
// au toast withdrawFeedback existant) : un tap sur une étoile est une
// décision qui demande plus de 3.5s de lecture, l'encart reste donc affiché
// jusqu'à action ou fermeture manuelle.
function QuickRateToast({ lang, onRate, onDismiss }) {
  const t = I18N[lang] ?? I18N.fr
  const title = t.title
  const closeLabel = t.close
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', borderRadius: '12px',
      background: '#B85000', color: '#fff',
      boxShadow: '0 6px 20px rgba(224,120,32,0.35)', maxWidth: '320px',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{title}</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onRate(n)}
            aria-label={`${n}/5`}
            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#fff' }}>
            <LuStar size={18} fill="none" strokeWidth={2.2} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onDismiss} aria-label={closeLabel}
        style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: '#fff', opacity: 0.7, flexShrink: 0 }}>
        <LuX size={16} />
      </button>
    </div>
  )
}

/**
 * @returns {(userId: string, opts: { recipeId: string, recipeSource: string, lang?: string }) => Promise<void>}
 */
export function useQuickRatePrompt() {
  const { show, dismiss } = useToast()
  return useCallback(async (userId, { recipeId, recipeSource, lang = 'fr' } = {}) => {
    if (!userId || !recipeId || !recipeSource) return
    let existing
    try {
      existing = await getMyReview(userId, recipeId, recipeSource)
    } catch {
      return // ne casse jamais le flux de cuisson
    }
    if (existing) return // déjà noté : pas de sursollicitation

    const id = `quick-rate-${recipeId}`
    const handleRate = (rating) => {
      dismiss(id)
      upsertReview(userId, { recipeId, recipeSource, rating, body: null })
    }
    show(
      <QuickRateToast lang={lang} onRate={handleRate} onDismiss={() => dismiss(id)} />,
      { id, duration: 0 },
    )
  }, [show, dismiss])
}
