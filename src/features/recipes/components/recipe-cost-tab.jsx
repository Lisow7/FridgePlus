import { calcRecipeCostByMode, COST_MODES, formatPrice } from '@shared/lib/recipes/recipe-utils'
import { computeCostRows } from '@features/recipes/lib/recipe-cost-rows'
import Button from '@shared/ui/button'
import InfoTooltip from '@shared/ui/info-tooltip'

// Vue de l'onglet Coût du RecipeModal — extraite (2026-07-25, audit front §2).
//
// Montée UNIQUEMENT quand l'onglet Coût est actif (le parent garde le gate
// `activeTab === 'cost' && hasPremiumAccess`), donc toute la dérivation
// ci-dessous (rows/total/displayedCost…) reste lazy, comme dans l'inline
// d'origine. L'état persistant vit dans useRecipeCost (parent) et arrive via
// `cost`. Déplacement verbatim — aucun changement de comportement.
export default function RecipeCostTab({ recipe, lang, darkMode = false, ingredientsById, stock, scaleFactor, t, cost }) {
  const { costMode, setCostMode, livePrices, liveLoading, liveUpdatedAt, refresh } = cost

  const rows = computeCostRows({ recipe, lang, ingredientsById, livePrices, scaleFactor, stock })
  const total = rows.reduce((s, r) => r.itemPrice != null ? s + r.itemPrice : s, 0)
  const hasAnyPrice = rows.some(r => r.itemPrice != null)
  const liveCount = rows.filter(r => r.isLive).length
  const sep = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const liveTime = liveUpdatedAt
    ? new Date(liveUpdatedAt).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null
  const displayedCost = calcRecipeCostByMode(recipe, {
    mode: costMode, lang, scaleFactor, ingredientsById,
    stock: costMode === COST_MODES.MARGINAL ? stock : undefined,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)', margin: 0 }}>
          {t.costBreakdownLabel}
        </p>
        <Button
          variant="ghost"
          onClick={refresh}
          loading={liveLoading}
          disabled={liveLoading}
          className="h-auto rounded-md px-2 py-0.5 text-xs hover:bg-transparent"
          style={{
            background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            color: 'var(--color-muted)',
          }}
        >
          {liveLoading ? t.costRefreshing : t.costRefreshBtn}
        </Button>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 2px',
          borderBottom: i < rows.length - 1 ? `1px solid ${sep}` : 'none',
        }}>
          <span style={{
            fontSize: '13px', flexShrink: 0, fontWeight: 700,
            color: row.inStock ? '#4CAF7D' : row.required ? (darkMode ? '#FCA5A5' : '#D04040') : 'var(--color-muted)',
          }}>
            {row.inStock ? '✓' : row.required ? '✗' : '○'}
          </span>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: 'var(--color-charcoal)', minWidth: 0 }}>
            {row.label}
            {!row.required && <span style={{ fontSize: '11px', color: 'var(--color-muted)', marginLeft: '3px' }}>*</span>}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-muted)', flexShrink: 0 }}>
            {row.qtyStr ?? '—'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: '52px' }}>
            <span style={{
              fontSize: '13px', fontWeight: 700,
              color: row.itemPrice != null ? (darkMode ? 'var(--color-brand-400)' : '#C05A10') : 'var(--color-muted)',
            }}>
              {row.itemPrice != null ? formatPrice(row.itemPrice, lang) : '—'}
            </span>
            {row.isLive && row.itemPrice != null && (
              <span style={{ fontSize: '10px', color: '#4CAF7D', fontWeight: 600, letterSpacing: '0.04em' }}>
                {t.costLiveBadge}
              </span>
            )}
          </div>
        </div>
      ))}

      {hasAnyPrice ? (
        <>
          {/* P12.c — Sélecteur de mode coût (3 options, segment control) */}
          <div role="radiogroup" aria-label={t.costLabel} style={{
            marginTop: '14px', display: 'flex', gap: '6px',
          }}>
            {[
              { mode: COST_MODES.TOTAL,       label: t.costModeTotal },
              { mode: COST_MODES.PER_SERVING, label: t.costModePerServing },
              { mode: COST_MODES.MARGINAL,    label: t.costModeMarginal },
            ].map(opt => {
              const sel = costMode === opt.mode
              return (
                <Button
                  key={opt.mode}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setCostMode(opt.mode)}
                  className="h-auto flex-1 rounded-[8px] border-[1.5px] px-2 py-1.5 text-[12px] transition-all duration-150"
                  style={{
                    borderColor: sel ? 'var(--color-brand-500)' : sep,
                    background: sel
                      ? (darkMode ? 'rgba(224,120,32,0.15)' : 'rgba(224,120,32,0.08)')
                      : 'transparent',
                    color: sel ? 'var(--color-brand-500)' : 'var(--color-muted)',
                    fontWeight: sel ? 700 : 500,
                  }}
                >
                  {opt.label}
                </Button>
              )
            })}
          </div>

          {/* Bloc affichage prix + label adaptatif */}
          <div style={{
            marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: '10px',
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${sep}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-charcoal)' }}>
                {costMode === COST_MODES.PER_SERVING ? t.costPerServingLabel
                  : costMode === COST_MODES.MARGINAL ? t.costMarginalLabel
                  : t.costTotal}
              </span>
              <InfoTooltip
                text={t.costRecipeNote.split('\n\n').map((p, i) => (
                  <span key={i} style={{ display: 'block', marginBottom: i === 0 ? '10px' : 0 }}>{p}</span>
                ))}
                darkMode={darkMode}
                align="left"
              />
            </div>
            <span style={{ fontSize: '17px', fontWeight: 800, color: darkMode ? '#E0C890' : 'var(--color-charcoal)' }}>
              {/* En mode marginal, displayedCost peut être null si tout est en stock — afficher 0 € */}
              {displayedCost == null && costMode === COST_MODES.MARGINAL
                ? formatPrice(0, lang)
                : displayedCost != null
                  ? formatPrice(displayedCost, lang)
                  : formatPrice(total, lang)}
            </span>
          </div>
        </>
      ) : (
        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-muted)', fontStyle: 'italic' }}>{t.costNoData}</p>
      )}
      <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--color-muted)', opacity: 0.65 }}>{t.costOptionalNote}</p>
      <div style={{
        marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', color: 'var(--color-muted)', opacity: 0.6,
      }}>
        {liveCount > 0 ? (
          <>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4CAF7D', flexShrink: 0 }} />
            <span>{liveCount} via {t.costLiveSource}{liveTime ? ` · ${t.costLastUpdated(liveTime)}` : ''}</span>
          </>
        ) : (
          <span>{t.costEstimated}</span>
        )}
      </div>
    </div>
  )
}
