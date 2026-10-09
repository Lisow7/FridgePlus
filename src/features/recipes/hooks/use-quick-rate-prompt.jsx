import { useCallback, useEffect, useRef } from 'react'
import { LuStar, LuX } from 'react-icons/lu'
import { useToast } from '@shared/ui/toast/toast-provider'
import { useSaveErrorToast } from '@shared/hooks/use-save-error-toast'
import { getMyReview, upsertReview } from '@features/recipes/api/recipe-reviews'

const I18N = {
  fr: { title: 'Comment c\'était ?', close: 'Fermer' },
  en: { title: 'How was it?', close: 'Close' },
}

// Toast de notation rapide 1-tap, affiché après un `logCooking()` réussi
// (cf. use-recipe-modal.js). Il part tout seul au bout de QUICK_RATE_MS, et
// dès qu'on quitte la fiche ou qu'on change de recette : retour d'Antoine du
// 2026-10-04 — il restait collé en bas de l'écran, sur l'accueil, longtemps
// après la recette qu'il concernait (`duration: 0` à l'origine).
export const QUICK_RATE_MS = 3000

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
 * @param {string|undefined} currentRecipeId recette affichée par la fiche
 * @returns {(userId: string, opts: { recipeId: string, recipeSource: string, lang?: string }) => Promise<void>}
 */
export function useQuickRatePrompt(currentRecipeId) {
  const { show, dismiss } = useToast()
  const signalerEchec = useSaveErrorToast()
  // Incrémenté quand la fiche se ferme ou change de recette : une invite dont
  // la lecture de l'avis (réseau) se termine APRÈS ce moment ne s'affiche pas.
  const generation = useRef(0)
  const shownId = useRef(null)

  useEffect(() => () => {
    generation.current += 1
    if (shownId.current) dismiss(shownId.current)
    shownId.current = null
  }, [currentRecipeId, dismiss])

  return useCallback(async (userId, { recipeId, recipeSource, lang = 'fr' } = {}) => {
    if (!userId || !recipeId || !recipeSource) return
    const gen = generation.current
    let existing
    try {
      existing = await getMyReview(userId, recipeId, recipeSource)
    } catch {
      return // ne casse jamais le flux de cuisson
    }
    if (existing) return // déjà noté : pas de sursollicitation
    if (gen !== generation.current) return // fiche quittée entre-temps

    const id = `quick-rate-${recipeId}`
    // La note part ; si la base la refuse, on le dit (le résultat était jeté
    // jusqu'au 2026-10-05 : une note « donnée » pouvait n'exister nulle part).
    const handleRate = async (rating) => {
      dismiss(id)
      let refusee
      try { refusee = !!(await upsertReview(userId, { recipeId, recipeSource, rating, body: null }))?.error }
      catch { refusee = true }
      if (refusee) signalerEchec('rating')
    }
    shownId.current = id
    show(
      <QuickRateToast lang={lang} onRate={handleRate} onDismiss={() => dismiss(id)} />,
      { id, duration: QUICK_RATE_MS },
    )
  }, [show, dismiss, signalerEchec])
}
