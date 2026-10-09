import { useEffect, useMemo, useState } from 'react'
import { LuLock, LuTrendingUp, LuTrendingDown, LuMinus, LuTriangleAlert, LuSparkles, LuChartBar } from 'react-icons/lu'
import { listSpendingEvents } from '@shared/api/spending'
import { getMonthlyTotals, getDailyTotals, getWeeklyTotals, getYearlyTotals, getStaticRecommendations } from '@shared/lib/spending/spending-stats'
import { getMonthlyBudget } from '@shared/api/budget'
import Button from '@shared/ui/button'
import SegmentedControl from '@shared/ui/segmented-control'
import SpendingInsights from '@features/profile/components/spending-insights'

// Dashboard analyse dépenses Premium.
// Données alimentées par spending_events (capturé au moment "J'ai fait
// mes courses" → handleConfirmAddToFridge dans App.jsx).
//
// Paywall dur : si !hasPremiumAccess, l'onglet est flouté + CTA Premium.

const I18N = {
  fr: {
    title: 'Mes dépenses',
    budgetLineTitle: (b) => `Budget : ${b} €`,
    subtitle: 'Suivi mensuel de tes courses et recommandations personnalisées.',
    paywallTitle: 'Réservé aux membres Premium',
    paywallDesc: 'Visualise ton historique, ton évolution mensuelle et reçois des conseils personnalisés pour optimiser ton budget.',
    paywallCta: 'Découvrir Premium',
    chartTitle: '12 derniers mois',
    chartEmpty: 'Aucune dépense enregistrée. Tes courses apparaîtront ici dès que tu cliques « J\'ai fait mes courses » dans le panier.',
    recoTitle: 'Recommandations',
    // v3.412 PR-E — labels pour les 4 vues + titres
    viewDay:    'Jour',
    viewWeek:   'Semaine',
    viewMonth:  'Mois',
    viewYear:   'Année',
    chartDayTitle:   '7 derniers jours',
    chartWeekTitle:  '12 dernières semaines',
    chartMonthTitle: '12 derniers mois',
    chartYearTitle:  '5 dernières années',
    monthLabels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
    monthLabelsLong: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
    reco: {
      no_data: 'Pas encore assez de données pour générer des conseils. Reviens après quelques courses !',
      up_vs_prev:    (p) => `Ce mois-ci, tu dépenses ${p.pct} % de plus que le mois dernier.`,
      down_vs_prev:  (p) => `Belle économie : ${p.pct} % de moins que le mois dernier.`,
      over_budget:   (p) => `Tu dépasses ton budget de ${p.pct} % (${p.spent.toFixed(2)} € sur ${p.budget} € prévus).`,
      under_budget:  (p) => `Tu es ${p.pct} % en dessous de ton budget (${p.spent.toFixed(2)} € sur ${p.budget} €). Bravo !`,
      on_budget:     (p) => `Budget tenu : ${p.spent.toFixed(2)} € sur ${p.budget} € (${p.pct} %).`,
      peak_month:    () => 'C\'est ton mois le plus dépensier de l\'historique. Ça vaut le coup d\'analyser pourquoi.',
      monthly_avg:   (p) => `Moyenne mensuelle : ${p.avg.toFixed(2)} €.`,
    },
    loading: 'Chargement…',
    weekPrefix: 'Sem. ',
    periodLabel: "Période d'analyse",
    budgetLabel: 'Budget mensuel',
    weekTooltip: (w, range, amount) => `Sem. ${w} (${range}) : ${amount} €`,
  },
  en: {
    title: 'My spending',
    budgetLineTitle: (b) => `Budget: €${b}`,
    subtitle: 'Monthly tracking of your shopping and personalized tips.',
    paywallTitle: 'Premium members only',
    paywallDesc: 'Visualize your history, monthly trends and get personalized advice to optimize your budget.',
    paywallCta: 'Discover Premium',
    chartTitle: 'Last 12 months',
    chartEmpty: 'No spending recorded yet. Your shopping trips will appear here as soon as you tap "I did my shopping" from the cart.',
    recoTitle: 'Recommendations',
    viewDay:    'Day',
    viewWeek:   'Week',
    viewMonth:  'Month',
    viewYear:   'Year',
    chartDayTitle:   'Last 7 days',
    chartWeekTitle:  'Last 12 weeks',
    chartMonthTitle: 'Last 12 months',
    chartYearTitle:  'Last 5 years',
    monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthLabelsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    reco: {
      no_data: 'Not enough data yet to generate tips. Come back after a few shopping trips!',
      up_vs_prev:    (p) => `This month, you're spending ${p.pct}% more than last month.`,
      down_vs_prev:  (p) => `Nice savings: ${p.pct}% less than last month.`,
      over_budget:   (p) => `You're ${p.pct}% over budget (€${p.spent.toFixed(2)} of €${p.budget} planned).`,
      under_budget:  (p) => `You're ${p.pct}% under budget (€${p.spent.toFixed(2)} of €${p.budget}). Well done!`,
      on_budget:     (p) => `On budget: €${p.spent.toFixed(2)} of €${p.budget} (${p.pct}%).`,
      peak_month:    () => 'This is your highest-spending month so far. Worth a closer look.',
      monthly_avg:   (p) => `Monthly average: €${p.avg.toFixed(2)}.`,
    },
    loading: 'Loading…',
    weekPrefix: 'W',
    periodLabel: 'Analysis period',
    budgetLabel: 'Monthly budget',
    weekTooltip: (w, range, amount) => `Week ${w} (${range}): €${amount}`,
  },
}

const SEVERITY_COLOR = {
  info:    { bg: 'rgba(120,140,180,0.12)', fg: '#5060A0', icon: LuMinus },
  success: { bg: 'rgba(80,160,80,0.12)',   fg: '#3E8000', icon: LuTrendingDown },
  warning: { bg: 'rgba(247,168,32,0.14)',  fg: '#B45309', icon: LuTrendingUp },
  alert:   { bg: 'rgba(208,96,96,0.14)',   fg: '#C82020', icon: LuTriangleAlert },
}

export default function SpendingDashboard({
  userId,
  hasPremiumAccess,
  onUpgrade,
  lang = 'fr',
  darkMode = false,
  isMobile = false,
}) {
  const t = I18N[lang] ?? I18N.fr
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [budget, setBudget] = useState(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasPremiumAccess || !userId) { setLoading(false); return }
    let cancelled = false
    Promise.all([listSpendingEvents(userId, 12), getMonthlyBudget(userId)])
      .then(([evs, b]) => {
        if (cancelled) return
        setEvents(evs)
        // v3.412 fix : getMonthlyBudget retourne { budget, error } (objet)
        // pas juste un number. Sans extract, `budget` était un objet ce
        // qui cassait maxValue → NaN → barre invisible + reco affiche
        // « [object Object] » + NaN %.
        setBudget(b?.budget ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, hasPremiumAccess])

  // v3.412 PR-E — vue par jour/semaine/mois/an. Le state vit ici, le
  // Chart est générique (reçoit data + label formatter).
  const [view, setView] = useState('month')
  const monthly = useMemo(() => getMonthlyTotals(events, 12), [events])
  const recos = useMemo(() => getStaticRecommendations(monthly, budget), [monthly, budget])
  const viewData = useMemo(() => {
    // Day view = 7 derniers jours (1 semaine) selon feedback user.
    if (view === 'day')   return getDailyTotals(events, 7)
    if (view === 'week')  return getWeeklyTotals(events, 12)
    if (view === 'year')  return getYearlyTotals(events, 5)
    return monthly
  }, [view, events, monthly])
  // Helper : numéro de semaine ISO 8601 (1-53)
  const isoWeek = (d) => {
    const target = new Date(d.valueOf())
    const dayNr = (d.getDay() + 6) % 7
    target.setDate(target.getDate() - dayNr + 3)
    const firstThursday = new Date(target.getFullYear(), 0, 4)
    const diff = target - firstThursday
    return 1 + Math.round(diff / (7 * 24 * 3600 * 1000))
  }
  // Formatter de label selon la vue (axe X du chart). Format clair :
  //   - Jour    : « 16 mai » (jour + mois court)
  //   - Semaine : « Sem. 20 » (numéro ISO)
  //   - Mois    : « Mai » (mois court)
  //   - Année   : « 2026 »
  const formatLabel = (bucket) => {
    if (view === 'day') {
      const d = bucket.date
      return `${d.getDate()} ${t.monthLabels[d.getMonth()]}`
    }
    if (view === 'week') {
      const d = bucket.weekStart
      return t.weekPrefix + isoWeek(d)
    }
    if (view === 'year') return String(bucket.year)
    return t.monthLabels[bucket.month]
  }
  const formatTooltip = (bucket) => {
    if (view === 'day') {
      const d = bucket.date
      return `${d.getDate()} ${t.monthLabelsLong[d.getMonth()]} ${d.getFullYear()} : ${bucket.total.toFixed(2)} €`
    }
    if (view === 'week') {
      const d = bucket.weekStart
      const end = new Date(d); end.setDate(d.getDate() + 6)
      const w = isoWeek(d)
      const range = `${d.getDate()} ${t.monthLabels[d.getMonth()]} – ${end.getDate()} ${t.monthLabels[end.getMonth()]}`
      return t.weekTooltip(w, range, bucket.total.toFixed(2))
    }
    if (view === 'year') return `${bucket.year} : ${bucket.total.toFixed(2)} €`
    return `${t.monthLabelsLong[bucket.month]} ${bucket.year} : ${bucket.total.toFixed(2)} €`
  }
  const chartTitle = view === 'day' ? t.chartDayTitle
    : view === 'week' ? t.chartWeekTitle
    : view === 'year' ? t.chartYearTitle
    : t.chartMonthTitle

  // ── Paywall ──────────────────────────────────────────────────────────────
  if (!hasPremiumAccess) {
    return <Paywall t={t} onUpgrade={onUpgrade} darkMode={darkMode} isMobile={isMobile} />
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: darkMode ? '#A0A8B8' : '#7A6A52', fontSize: '14px' }}>
        {t.loading}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
      {/* v3.412 PR-E — Pas de titre interne : ProfilePageIntro fournit
          déjà le h1 « Mes dépenses » + intro descriptive. Éviter la
          duplication. Si jamais ce composant est utilisé hors page dédiée,
          le caller fournira son propre titre. */}

      {/* v3.412 PR-E — toggle vues (jour/semaine/mois/an). */}
      <SegmentedControl
        options={[
          { value: 'day',   label: t.viewDay },
          { value: 'week',  label: t.viewWeek },
          { value: 'month', label: t.viewMonth },
          { value: 'year',  label: t.viewYear },
        ]}
        value={view}
        onChange={setView}
        aria-label={t.periodLabel}
      />

      <Chart
        data={viewData}
        chartTitle={chartTitle}
        formatLabel={formatLabel}
        formatTooltip={formatTooltip}
        view={view}
        t={t}
        darkMode={darkMode}
        isMobile={isMobile}
        budget={budget}
      />

      {/* v3.415 PR-E.2 — Analytics étendues (projection, breakdown, top 5).
          Filtré sur la période active : viewData.length × items_json mais on
          réutilise `events` brut car la projection a besoin du mois courant
          spécifiquement. Breakdown/Top sont calculés sur la fenêtre passée
          au listSpendingEvents (12 mois par défaut), ce qui donne assez de
          signal sur toutes les vues. */}
      <SpendingInsights
        events={events}
        view={view}
        budget={budget}
        lang={lang}
        darkMode={darkMode}
        isMobile={isMobile}
      />

      {events.length > 0 && (
        <div>
          <p style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: 800, color: darkMode ? 'var(--color-bg-warm)' : '#2C1A0E', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LuSparkles size={13} />
            {t.recoTitle}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recos.map((r, i) => {
              const sev = SEVERITY_COLOR[r.severity] ?? SEVERITY_COLOR.info
              const Icon = sev.icon
              const text = typeof t.reco[r.key] === 'function' ? t.reco[r.key](r.payload) : t.reco[r.key]
              return (
                <div key={`${r.key}-${i}`} style={{
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: '10px',
                  background: sev.bg, color: sev.fg,
                  fontSize: '13px', fontWeight: 600, lineHeight: 1.5,
                }}>
                  <Icon size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Paywall({ t, onUpgrade, darkMode, isMobile }) {
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  return (
    <div style={{
      padding: isMobile ? '32px 18px' : '40px 24px',
      textAlign: 'center',
      borderRadius: '16px',
      border: `1.5px dashed ${darkMode ? '#3A4860' : '#C8B8A0'}`,
      background: darkMode ? 'rgba(255,168,32,0.04)' : 'rgba(255,168,32,0.05)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--gradient-warm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(212,106,16,0.30)',
      }}>
        <LuLock size={26} color="#FFF" />
      </div>
      <div>
        <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: fg }}>{t.paywallTitle}</p>
        <p style={{ margin: 0, fontSize: '13px', color: muted, lineHeight: 1.5, maxWidth: '380px' }}>{t.paywallDesc}</p>
      </div>
      <Button
        onClick={onUpgrade}
        type="button"
        className="h-auto rounded-xl bg-none bg-[#B85000] px-6 py-3 text-sm font-extrabold text-white shadow-[0_3px_14px_rgba(184,80,0,0.30)]"
      >
        ✨ {t.paywallCta}
      </Button>
    </div>
  )
}

function Chart({ data, chartTitle, formatLabel, formatTooltip, view, t, darkMode, isMobile, budget }) {
  // v3.412 PR-E — chart générique compatible jour/semaine/mois/an. `data`
  // est un Array<{ key, total, count, ... }>. Les autres props (format*)
  // s'occupent des labels axe X + tooltips selon la vue.
  // Pour vue 'month' uniquement on affiche la ligne de budget mensuel
  // (budget = monthly_budget). Sur jour/semaine/an, pas de sens.
  const showBudgetLine = view === 'month' && budget
  const maxValue = Math.max(...data.map(m => Number(m.total) || 0), showBudgetLine ? Number(budget) : 0, 1)
  const fg = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const totalEvents = data.reduce((s, m) => s + m.count, 0)

  if (totalEvents === 0) {
    return (
      <div style={{
        padding: isMobile ? '32px 16px' : '40px 24px',
        textAlign: 'center',
        borderRadius: '12px',
        border: `1.5px dashed ${border}`,
        color: muted, fontSize: '14px', fontStyle: 'italic', lineHeight: 1.5,
      }}>
        <LuChartBar size={28} color={muted} style={{ marginBottom: '10px', opacity: 0.6 }} />
        <p style={{ margin: 0 }}>{t.chartEmpty}</p>
      </div>
    )
  }

  // v3.412 PR-E — axe Y dynamique. Gradations adaptées : si max=0, on évite
  // les doublons « 1 1 0 ». 3 niveaux normalement, 2 si max trop petit.
  const yMax = maxValue
  const yMid = Math.round(yMax / 2)
  const showMid = yMid > 0 && yMid < yMax

  return (
    <div style={{
      padding: isMobile ? '14px' : '16px',
      borderRadius: '12px',
      border: `1px solid ${border}`,
      background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
    }}>
      {/* v3.413 — Header en colonnes (titre dessus, légende budget dessous)
          pour éviter le chevauchement quand le label budget est long. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: fg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{chartTitle}</p>
        {showBudgetLine && (
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: darkMode ? '#FFA832' : '#D46A10', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span aria-hidden style={{ display: 'inline-block', width: 18, height: 0, borderTop: `2px dashed ${darkMode ? '#FFA832' : '#D46A10'}` }} />
            {t.budgetLabel} : {Math.round(Number(budget))} €
          </p>
        )}
      </div>

      {/* v3.413 — Axe Y + zone barres indépendante (la ligne budget se
          positionne par rapport à la zone barres uniquement, pas à
          l'ensemble titre + barres + labels axe X). */}
      <div style={{ display: 'flex', gap: '8px', height: '180px' }}>
        {/* Axe Y avec graduations alignées sur les lignes de grille */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          paddingBottom: '22px', // hauteur des labels axe X (font-size 10 + gap)
          fontSize: '10px', fontWeight: 600, color: muted,
          textAlign: 'right', minWidth: '36px',
        }}>
          <span>{Math.round(yMax)} €</span>
          {showMid && <span>{yMid} €</span>}
          <span>0</span>
        </div>

        {/* Colonne droite : zone barres (flex:1) + labels axe X (auto) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Zone barres uniquement — le budget % est calculé sur SA hauteur */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            {/* Lignes de grille horizontales en arrière-plan */}
            <div aria-hidden="true" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none',
            }}>
              {(showMid ? [0, 1, 2] : [0, 1]).map((i) => (
                <div key={i} style={{
                  borderTop: `1px dashed ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                  width: '100%',
                }} />
              ))}
            </div>

            {/* Ligne budget mensuel (vue 'month') — bottom % relatif à la zone barres */}
            {showBudgetLine && (
              <div style={{
                position: 'absolute', left: 0, right: 0,
                bottom: `${(Number(budget) / yMax) * 100}%`,
                borderTop: `2px dashed ${darkMode ? '#FFA832' : '#D46A10'}`,
                zIndex: 3, pointerEvents: 'none',
              }} title={t.budgetLineTitle(budget)} />
            )}

            {data.map((m) => {
              const heightPct = m.total > 0 ? Math.max(2, (m.total / yMax) * 100) : 0
              const isOverBudget = showBudgetLine && m.total > Number(budget)
              const barColor = m.total === 0
                ? (darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)')
                : isOverBudget
                  ? (darkMode
                    ? 'linear-gradient(180deg, #FF6B4A 0%, #DC2626 100%)'
                    : 'var(--color-brand-500)')
                  : (darkMode
                    ? 'linear-gradient(180deg, #FFB366 0%, #FF7B14 100%)'
                    : 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)')
              const barShadow = m.total > 0
                ? (darkMode
                  ? (isOverBudget
                    ? '0 0 12px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                    : '0 0 12px rgba(255,140,40,0.45), inset 0 1px 0 rgba(255,255,255,0.18)')
                  : '0 2px 8px rgba(212,106,16,0.32)')
                : 'none'
              return (
                // v3.413 — `height: '100%'` indispensable : sans ça, la cellule
                // n'a aucune hauteur (parent align-items: flex-end ne stretche
                // pas) → height: ${heightPct}% = 0px = barre invisible.
                <div key={m.key} style={{
                  flex: 1, minWidth: 0, height: '100%',
                  display: 'flex', alignItems: 'flex-end',
                  position: 'relative', zIndex: 2,
                }}>
                  <div
                    title={formatTooltip(m)}
                    style={{
                      width: '100%',
                      height: m.total > 0 ? `${heightPct}%` : '2px',
                      background: barColor,
                      boxShadow: barShadow,
                      borderRadius: '4px 4px 0 0',
                      transition: 'height .3s',
                      position: 'relative',
                    }}
                  >
                    {m.total > 0 && (
                      <span style={{
                        position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)',
                        fontSize: '11px', fontWeight: 700, color: fg, whiteSpace: 'nowrap',
                      }}>
                        {Math.round(m.total)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Labels axe X — hors de la zone barres pour que le % budget soit propre */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            {data.map((m) => (
              <div key={m.key} style={{
                flex: 1, minWidth: 0, textAlign: 'center',
                fontSize: '10px', fontWeight: 600, color: muted,
                whiteSpace: 'nowrap', overflow: 'visible',
              }}>
                {formatLabel(m)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
