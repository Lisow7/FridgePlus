// Popover de suggestions de substituts pour un ingrédient absent du stock.
// Lazy-fetch : ne déclenche l'appel Edge Function qu'à l'ouverture (économie cache).

import { useEffect } from 'react'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import { useSubstitutes } from '@shared/hooks/use-substitutes'
import { useSubscription } from '@shared/hooks/use-subscription'
import { useUpgradeModal } from '@shared/contexts/subscription-modal-provider'
import { PREMIUM_ENABLED } from '@shared/lib/premium-config'
import Button from '@shared/ui/button'
import { LuX, LuLoader, LuStar } from 'react-icons/lu'

const I18N = {
  fr: {
    title: 'Substituts IA',
    loading: 'Recherche de substituts…',
    error: 'Impossible de proposer des substituts pour le moment.',
    empty: 'Aucune suggestion disponible.',
    close: 'Fermer',
    ratio: 'Proportion',
    poweredBy: 'Suggestions générées par IA — à vérifier selon tes goûts',
    premiumBadge: 'Premium',
    soonBadge: 'Prochainement',
    premiumTeaser: 'Pas l\'ingrédient sous la main ? L\'IA te suggère 3 remplacements adaptés, avec les bonnes proportions.',
    comingSoon: 'Bientôt disponible',
    upgrade: 'Passer à Premium',
  },
  en: {
    title: 'AI substitutes',
    loading: 'Looking up substitutes…',
    error: 'Unable to suggest substitutes right now.',
    empty: 'No suggestion available.',
    close: 'Close',
    ratio: 'Ratio',
    poweredBy: 'AI-generated suggestions — verify to match your taste',
    premiumBadge: 'Premium',
    soonBadge: 'Coming soon',
    premiumTeaser: 'Missing an ingredient? AI suggests 3 recipe-tailored swaps, with the right proportions.',
    comingSoon: 'Coming soon',
    upgrade: 'Upgrade to Premium',
  },
}

export default function RecipeSubstitutePopover({
  ingredientLabel,
  recipeContext,
  lang = 'fr',
  darkMode = false,
  onClose,
}) {
  const t = I18N[lang] ?? I18N.fr
  useCloseOnBackButton(true, onClose)
  const { suggest, substitutes, loading, error } = useSubstitutes()
  // Feature IA coûteuse (appel OpenAI facturé) → réservée au Premium. On NE
  // déclenche PAS l'appel Edge Function pour un non-premium (coût zéro) et on
  // affiche l'UpgradeGate à la place. Le backend re-vérifie le premium (403).
  const { hasPremiumAccess } = useSubscription()
  const { openUpgradeModal } = useUpgradeModal()

  // Lazy-fetch dès l'ouverture du popover — Premium uniquement.
  useEffect(() => {
    if (!hasPremiumAccess) return
    suggest({ ingredient_label: ingredientLabel, recipe_context: recipeContext, lang })
      .catch(() => {})  // l'erreur est déjà capturée dans le hook state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientLabel, recipeContext, lang, hasPremiumAccess])

  const bg     = darkMode ? '#131E2C' : '#FDFAF6'
  const border = darkMode ? '1.5px solid #1A2A3D' : '1.5px solid #E8D5B8'
  const text   = darkMode ? 'rgba(255,255,255,0.92)' : 'var(--color-charcoal)'
  const muted  = darkMode ? 'rgba(255,255,255,0.55)' : 'var(--color-muted)'
  const accent = darkMode ? '#7BB078' : '#3A6A38'

  return (
    <div
      role="dialog"
      aria-label={t.title}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: '28px', right: 0,
        zIndex: 60,
        borderRadius: '12px',
        border,
        background: bg,
        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        animation: 'popover-enter 0.18s ease-out both',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px',
        borderBottom: `1px solid ${darkMode ? '#1A2A3D' : '#EDE4D4'}`,
        background: darkMode ? '#0F1923' : '#FFF',
      }}>
        <span style={{ fontSize: '16px' }}>🔄</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: text, flex: 1 }}>
          {t.title} — {ingredientLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: muted, padding: '2px', display: 'flex', alignItems: 'center',
          }}
        >
          <LuX size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Non-premium : teaser Premium compact (aucun appel IA → coût zéro).
            Taillé pour la largeur du popover (l'UpgradeGate "hard" pleine
            largeur était tronquée ici). En Launch Free → « Bientôt dispo ». */}
        {!hasPremiumAccess && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', textAlign: 'center', padding: '2px 0 2px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 9px', borderRadius: '999px',
              background: 'var(--gradient-warm)', color: '#fff',
              fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <LuStar size={10} fill="#fff" color="#fff" />
              {PREMIUM_ENABLED ? t.premiumBadge : t.soonBadge}
            </span>
            <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5, color: text }}>
              {t.premiumTeaser}
            </p>
            {PREMIUM_ENABLED ? (
              <Button
                type="button"
                onClick={openUpgradeModal}
                className="h-auto w-full rounded-[9px] bg-none bg-[#B85000] px-3 py-2 text-[13px] font-bold text-white"
                style={{ gap: '5px' }}
              >
                <LuStar size={12} fill="#fff" color="#fff" />
                {t.upgrade}
              </Button>
            ) : (
              <span style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px', borderRadius: '9px', textAlign: 'center',
                background: 'rgba(212,106,16,0.10)',
                border: '1px dashed rgba(212,106,16,0.4)',
                color: 'var(--color-brand-600)', fontWeight: 800, fontSize: '13px',
              }}>
                {t.comingSoon}
              </span>
            )}
          </div>
        )}
        {hasPremiumAccess && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: muted, fontSize: '13px' }}>
            <LuLoader size={14} className="animate-spin" />
            {t.loading}
          </div>
        )}
        {hasPremiumAccess && error && !loading && (
          <p style={{ fontSize: '13px', color: '#D07070', margin: 0 }}>
            {t.error}
          </p>
        )}
        {hasPremiumAccess && !loading && !error && substitutes && substitutes.length === 0 && (
          <p style={{ fontSize: '13px', color: muted, margin: 0 }}>{t.empty}</p>
        )}
        {hasPremiumAccess && !loading && !error && substitutes && substitutes.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {substitutes.map((s, idx) => (
              <li key={idx} style={{
                padding: '10px 12px', borderRadius: '8px',
                background: darkMode ? '#0F1923' : '#FAF4E8',
                border: `1px solid ${darkMode ? '#1A2A3D' : '#EDE4D4'}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: accent, marginBottom: '4px' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '13px', color: text, lineHeight: 1.4, marginBottom: '4px' }}>
                  {s.reason}
                </div>
                <div style={{ fontSize: '12px', color: muted, fontStyle: 'italic' }}>
                  {t.ratio} : {s.ratio}
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasPremiumAccess && (
          <p style={{ fontSize: '11px', color: muted, marginTop: '10px', marginBottom: 0, fontStyle: 'italic' }}>
            {t.poweredBy}
          </p>
        )}
      </div>
    </div>
  )
}
