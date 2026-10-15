import { useMemo } from 'react'
import { LuTrendingUp, LuTrendingDown, LuTriangleAlert, LuTarget, LuChartPie, LuTrophy } from 'react-icons/lu'
import { getCategoryBreakdown, getTopExpensiveItems, getMonthProjection } from '@shared/lib/spending/spending-stats'
import { INGREDIENTS } from '@shared/static/ingredients'
import { suffixS } from '@shared/lib/i18n/pluralize'

// v3.415 PR-E.2 — analytics étendues Mes dépenses Premium.
// 3 sections (toujours sous le chart) :
//   1. Projection fin de mois (carte hero, vue 'month' uniquement)
//   2. Breakdown par catégorie (bar horizontal coloré)
//   3. Top 5 produits les plus coûteux (liste avec emoji)
//
// Toutes les analytics sont client-side, basées sur les events fournis
// par le parent (déjà filtrés sur la période active).

const I18N = {
  fr: {
    projectionTitle:    'Projection fin de mois',
    projectionNoData:   'Pas encore assez de données ce mois-ci pour projeter (au moins 3 jours requis).',
    projectionLine:     (p) => `Au rythme actuel, tu finiras le mois à environ ${p.projected.toFixed(2)} €.`,
    projectionDays:     (p) => `Basé sur ${p.daysElapsed} jour${p.daysElapsed > 1 ? 's' : ''} sur ${p.daysInMonth}.`,
    projectionVsBudget: (p) => p.deltaPct > 0
      ? `Soit ${p.deltaPct} % au-dessus de ton budget mensuel.`
      : p.deltaPct < 0
        ? `Soit ${Math.abs(p.deltaPct)} % en dessous de ton budget mensuel.`
        : 'Pile sur ton budget mensuel.',
    breakdownTitle:     'Répartition par catégorie',
    breakdownEmpty:     'Aucune dépense classable sur la période.',
    breakdownInfo:      'Sur la période sélectionnée, hors ingrédients non catégorisés.',
    topTitle:           'Top 5 produits les plus coûteux',
    topEmpty:           'Aucune dépense sur la période.',
    topUnknown:         'Ingrédient inconnu',
    topOccurrences:     (n) => `${n} fois`,
    categories: {
      frozen:  { label: 'Congelé',     color: '#4A90E2' },
      fresh:   { label: 'Frais',       color: '#6FCF97' },
      veggies: { label: 'Fruits & légumes', color: '#27AE60' },
      pantry:  { label: 'Épicerie',    color: '#A67C52' },
      spices:  { label: 'Épices',      color: '#E74C3C' },
      bakery:  { label: 'Boulangerie', color: '#F2C94C' },
      other:   { label: 'Autre',       color: '#9CA3AF' },
    },
  },
  en: {
    projectionTitle:    'End-of-month projection',
    projectionNoData:   'Not enough data this month to project yet (at least 3 days needed).',
    projectionLine:     (p) => `At the current pace, you’ll end the month around €${p.projected.toFixed(2)}.`,
    projectionDays:     (p) => `Based on ${p.daysElapsed} day${suffixS(p.daysElapsed, 'en')} out of ${p.daysInMonth}.`,
    projectionVsBudget: (p) => p.deltaPct > 0
      ? `That’s ${p.deltaPct}% above your monthly budget.`
      : p.deltaPct < 0
        ? `That’s ${Math.abs(p.deltaPct)}% below your monthly budget.`
        : 'Right on your monthly budget.',
    breakdownTitle:     'Breakdown by category',
    breakdownEmpty:     'No categorisable spending over the period.',
    breakdownInfo:      'Over the selected period, excluding uncategorised ingredients.',
    topTitle:           'Top 5 most expensive products',
    topEmpty:           'No spending over the period.',
    topUnknown:         'Unknown ingredient',
    topOccurrences:     (n) => `${n} time${suffixS(n, 'en')}`,
    categories: {
      frozen:  { label: 'Frozen',      color: '#4A90E2' },
      fresh:   { label: 'Fresh',       color: '#6FCF97' },
      veggies: { label: 'Fruits & veggies', color: '#27AE60' },
      pantry:  { label: 'Pantry',      color: '#A67C52' },
      spices:  { label: 'Spices',      color: '#E74C3C' },
      bakery:  { label: 'Bakery',      color: '#F2C94C' },
      other:   { label: 'Other',       color: '#9CA3AF' },
    },
  },
}

// Construit une fois la map id → { name, emoji } à partir des INGREDIENTS
// statiques (fallback offline). Une recherche → O(1) via Map.
function buildIngredientLookup(lang) {
  const map = new Map()
  for (const list of Object.values(INGREDIENTS)) {
    for (const item of list) {
      map.set(item.id, {
        name: item.labels?.[lang] ?? item.labels?.fr ?? item.id,
        emoji: item.emoji ?? '🍽️',
      })
    }
  }
  return map
}

const SEVERITY_STYLE = {
  success: { bg: 'rgba(34,197,94,0.10)',  fg: '#16A34A', Icon: LuTrendingDown },
  info:    { bg: 'rgba(120,140,180,0.10)', fg: '#5060A0', Icon: LuTarget },
  warning: { bg: 'rgba(247,168,32,0.12)',  fg: '#B45309', Icon: LuTrendingUp },
  alert:   { bg: 'rgba(220,38,38,0.10)',   fg: '#DC2626', Icon: LuTriangleAlert },
}

export default function SpendingInsights({
  events,
  view,
  budget,
  lang = 'fr',
  darkMode = false,
  isMobile = false,
}) {
  const t = I18N[lang] ?? I18N.fr
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const surface = darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)'

  const lookup = useMemo(() => buildIngredientLookup(lang), [lang])
  const breakdown = useMemo(() => getCategoryBreakdown(events), [events])
  const topItems = useMemo(() => getTopExpensiveItems(events, 5), [events])
  // Projection ne fait sens que sur la vue 'month' (on n'extrapole pas
  // sur 1 semaine / 1 an pour éviter des chiffres trompeurs).
  const projection = useMemo(
    () => (view === 'month' ? getMonthProjection(events, budget) : null),
    [view, events, budget]
  )

  if ((events?.length ?? 0) === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
      {/* ─── 1. Projection fin de mois (vue 'month') ──────────────── */}
      {view === 'month' && (
        <ProjectionCard
          projection={projection}
          t={t}
          fg={fg}
          muted={muted}
          border={border}
          isMobile={isMobile}
        />
      )}

      {/* ─── 2. Breakdown par catégorie ───────────────────────────── */}
      <Section title={t.breakdownTitle} IconCmp={LuChartPie} fg={fg} muted={muted}>
        {breakdown.length === 0 ? (
          <EmptyHint text={t.breakdownEmpty} muted={muted} border={border} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {breakdown.map((b) => {
              const meta = t.categories[b.key] ?? t.categories.other
              const pct = Math.round(b.ratio * 100)
              return (
                <div key={b.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: fg }}>
                      <span aria-hidden style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: meta.color, marginRight: 6, verticalAlign: 'middle',
                      }} />
                      {meta.label}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: muted, fontVariantNumeric: 'tabular-nums' }}>
                      {b.total.toFixed(2)} € · {pct}%
                    </span>
                  </div>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.max(2, b.ratio * 100)}%`,
                      background: meta.color,
                      borderRadius: 4,
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ─── 3. Top 5 produits les plus coûteux ───────────────────── */}
      <Section title={t.topTitle} IconCmp={LuTrophy} fg={fg} muted={muted}>
        {topItems.length === 0 ? (
          <EmptyHint text={t.topEmpty} muted={muted} border={border} />
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topItems.map((item, i) => {
              const meta = lookup.get(item.id)
              const name = meta?.name ?? t.topUnknown
              const emoji = meta?.emoji ?? '🍽️'
              return (
                <li key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  border: `1px solid ${border}`, background: surface,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: muted, minWidth: '18px', textAlign: 'center' }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>
                      {item.total.toFixed(2)} €
                    </span>
                    <span style={{ fontSize: '11px', color: muted }}>
                      {t.topOccurrences(item.count)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Section>
    </div>
  )
}

function Section(props) {
  // ESLint no-unused-vars + react/jsx-uses-vars : la destructuration inline
  // déclenche un faux positif sur la prop component capitalized. Passer par
  // props.X bypasse la heuristique et reste lisible.
  const { title, IconCmp, fg, muted, children } = props
  return (
    <div>
      <p style={{
        margin: '0 0 10px', fontSize: '12px', fontWeight: 800, color: fg,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {IconCmp && <IconCmp size={13} color={muted} />}
        {title}
      </p>
      {children}
    </div>
  )
}

function ProjectionCard({ projection, t, fg, muted, border, isMobile }) {
  if (!projection) {
    return (
      <Section title={t.projectionTitle} IconCmp={LuTarget} fg={fg} muted={muted}>
        <EmptyHint text={t.projectionNoData} muted={muted} border={border} />
      </Section>
    )
  }
  const sev = SEVERITY_STYLE[projection.severity] ?? SEVERITY_STYLE.info
  const IconCmp = sev.Icon
  return (
    <Section title={t.projectionTitle} IconCmp={LuTarget} fg={fg} muted={muted}>
      <div style={{
        padding: isMobile ? '14px' : '16px 18px',
        borderRadius: '12px',
        background: sev.bg,
        border: `1px solid ${border}`,
        display: 'flex', gap: '14px', alignItems: 'flex-start',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: sev.fg, color: '#FFF', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCmp size={18} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 700, color: fg, lineHeight: 1.4 }}>
            {t.projectionLine(projection)}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: muted }}>
            {t.projectionDays(projection)}
            {projection.deltaPct != null && <> · {t.projectionVsBudget(projection)}</>}
          </p>
        </div>
        <span style={{
          fontSize: isMobile ? '20px' : '24px', fontWeight: 800,
          color: sev.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {projection.projected.toFixed(0)} €
        </span>
      </div>
    </Section>
  )
}

function EmptyHint({ text, muted, border }) {
  return (
    <p style={{
      margin: 0, padding: '10px 14px', borderRadius: '8px',
      border: `1.5px dashed ${border}`, color: muted,
      fontSize: '13px', fontStyle: 'italic', lineHeight: 1.5,
    }}>
      {text}
    </p>
  )
}
