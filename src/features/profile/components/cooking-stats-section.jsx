import { useMemo, useState } from 'react'
import { topRecipes, countByLast6Months, countByLastNDays, countByLastNWeeks, countByLastNYears, mostActiveMonth, countThisMonth, uniqueRecipesCount, topCountry } from '@shared/lib/recipes/cooking-stats'
import SegmentedControl from '@shared/ui/segmented-control'

// Section Stats personnelles. Tous les calculs sont synchrones,
// purs, à partir du tableau de logs déjà chargé. Pas de PII supplémentaire :
// tout vient de `cooking_logs` (RLS user-only).
//
// Sprint 11 — refonte UX pour lisibilité/analytics :
//   - Pas de titre interne (le wrapper ProfileSection le fournit)
//   - Hero stat (total) en gros + comparaison vs mois précédent
//   - 2 mini-cards (Ce mois + Uniques) avec tendances %
//   - Pills inline (Mois actif + Pays favori) compactes
//   - Bar chart avec légende, axe Y, tendance globale
//   - Podium top 3 (🥇🥈🥉) + reste en liste discrète

/**
 * Compte les logs du mois précédent (relatif au mois courant).
 */
function countLastMonth(logs) {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const targetY = lastMonth.getFullYear()
  const targetM = lastMonth.getMonth() + 1
  let n = 0
  for (const log of logs) {
    const d = new Date(log.cooked_at)
    if (d.getFullYear() === targetY && d.getMonth() + 1 === targetM) n++
  }
  return n
}

/**
 * Renvoie le delta (signe + valeur absolue) entre 2 nombres et un signal.
 */
function trend(current, previous) {
  if (previous === 0 && current === 0) return { sign: 'flat', diff: 0, pct: null }
  if (previous === 0) return { sign: 'up', diff: current, pct: null }   // nouveauté
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  return {
    sign: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    diff: Math.abs(diff),
    pct: Math.abs(pct),
  }
}

// TREND_COLOR.flat utilise mutedColor (passé en prop) pour s'adapter au
// dark mode. Up/down sont sémantiques (vert succès / rouge alerte).
const TREND_ARROW = { up: '↑', down: '↓', flat: '→' }
const trendColor = (sign, mutedColor) => sign === 'up' ? '#16A34A' : sign === 'down' ? '#DC2626' : mutedColor

export default function CookingStatsSection({ logs, t, lang, isMobile, darkMode, border, textColor, mutedColor, baseRecipes, baseRecipeNames, customRecipes, countries }) {
  // v3.412 PR-E — hooks AVANT early returns (règle React).
  // Day view = 7 derniers jours (1 semaine).
  const [view, setView] = useState('month')
  // `logs ?? []` construisait un TABLEAU NEUF a chaque rendu quand `logs` etait
  // nul, et ce tableau servait de dependance : la memo ne memoisait alors rien.
  // Le repli vit desormais DANS la memo, dont la dependance est `logs` lui-meme.
  const chartData = useMemo(() => {
    const safeLogs = logs ?? []
    if (view === 'day')   return countByLastNDays(safeLogs, 7)
    if (view === 'week')  return countByLastNWeeks(safeLogs, 12)
    if (view === 'year')  return countByLastNYears(safeLogs, 5)
    return countByLast6Months(safeLogs).map(b => ({ ...b, key: `${b.year}-${b.month}` }))
  }, [view, logs])

  // ── États sentinelles (après les hooks) ─────────────────────────────
  if (logs === null) {
    return <p style={{ fontSize: '13px', color: mutedColor, fontStyle: 'italic' }}>…</p>
  }
  if (logs.length === 0) {
    return (
      <div style={{
        padding: '28px 16px', borderRadius: '12px',
        border: `1.5px dashed ${border}`,
        textAlign: 'center', color: mutedColor, fontSize: '13px',
        background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(247,168,94,0.05)',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
        {t.statsEmpty}
      </div>
    )
  }

  // ── Calculs ─────────────────────────────────────────────────────────
  const total       = logs.length
  const thisMonth   = countThisMonth(logs)
  const lastMonth   = countLastMonth(logs)
  const unique      = uniqueRecipesCount(logs)
  const top         = topRecipes(logs, 5)
  const bestMonth   = mostActiveMonth(logs)
  const bestCountry = topCountry(logs, (recipeId, source) => {
    if (source === 'custom') return customRecipes?.find(c => c.id === recipeId)?.country ?? null
    return baseRecipes?.find(c => c.id === recipeId)?.country ?? null
  })
  const monthTrend  = trend(thisMonth, lastMonth)
  const chartMax    = Math.max(1, ...chartData.map(b => b.count))

  // ── Stats additionnelles (S11.b feedback) ──────────────────────────
  // Portions moyennes par recette cuisinée (signal sur taille des repas).
  const totalServings = logs.reduce((sum, log) => sum + (Number(log.servings) || 0), 0)
  const avgServings = total > 0 ? (totalServings / total).toFixed(1) : '0'
  // Diversité culinaire = % de recettes uniques sur le total cuisiné.
  // 100% = jamais 2 fois la même, 20% = beaucoup de répétitions.
  const diversityPct = total > 0 ? Math.round((unique / total) * 100) : 0
  // Jour de la semaine le plus actif (0 = dim, 1 = lun, …, 6 = sam)
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const log of logs) {
    const d = new Date(log.cooked_at)
    if (!Number.isNaN(d.getTime())) dayCounts[d.getDay()]++
  }
  const topDayIndex = dayCounts.indexOf(Math.max(...dayCounts))
  const topDayCount = dayCounts[topDayIndex]
  const DAYS = {
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  }
  const topDayName = (DAYS[lang] ?? DAYS.fr)[topDayIndex]

  const resolveRecipe = (recipe_id, recipe_source) => {
    if (recipe_source === 'custom') {
      const r = customRecipes?.find(c => c.id === recipe_id)
      return r ? { emoji: r.emoji ?? '🍽️', name: r.name ?? recipe_id } : { emoji: '🍽️', name: t.journalUnknownRecipe }
    }
    const r = baseRecipes?.find(c => c.id === recipe_id)
    if (!r) return { emoji: '🍽️', name: t.journalUnknownRecipe }
    return {
      emoji: r.emoji ?? '🍽️',
      name: baseRecipeNames?.[recipe_id]?.[lang] ?? baseRecipeNames?.[recipe_id]?.fr ?? recipe_id,
    }
  }

  const heroBg = darkMode
    ? 'linear-gradient(135deg, rgba(247,168,94,0.10) 0%, rgba(212,106,16,0.06) 100%)'
    : 'linear-gradient(135deg, rgba(247,168,94,0.12) 0%, rgba(212,106,16,0.06) 100%)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px' }}>

      {/* ─── HERO : grand chiffre total + tendance mois ─────────────── */}
      <div style={{
        padding: isMobile ? '16px' : '20px 22px',
        borderRadius: '14px',
        background: heroBg,
        border: `1px solid ${darkMode ? 'rgba(247,168,94,0.20)' : 'rgba(212,106,16,0.15)'}`,
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.statsTotalCooked}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: 800, color: 'var(--color-warm-600)', lineHeight: 1 }}>
            {total}
          </span>
          <span style={{ fontSize: '13px', color: mutedColor }}>
            {t.statsRecipesCount(total)}
          </span>
        </div>
      </div>

      {/* ─── 2 mini-cards : Ce mois (avec tendance %) + Recettes uniques ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{
          padding: '12px 14px', borderRadius: '12px',
          border: `1px solid ${border}`,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.statsThisMonth}
          </span>
          <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 800, color: textColor, lineHeight: 1.1 }}>
            {thisMonth}
          </span>
          {(thisMonth > 0 || lastMonth > 0) && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: trendColor(monthTrend.sign, mutedColor), display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span>{TREND_ARROW[monthTrend.sign]}</span>
              <span>
                {monthTrend.sign === 'flat'
                  ? t.statsSameAsLastMonth
                  : monthTrend.pct != null
                    ? `${monthTrend.pct}% ${t.statsVsLastMonth}`
                    : `+${monthTrend.diff} ${t.statsNew}`}
              </span>
            </span>
          )}
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: '12px',
          border: `1px solid ${border}`,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.statsUnique}
          </span>
          <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 800, color: textColor, lineHeight: 1.1 }}>
            {unique}
          </span>
          <span style={{ fontSize: '11px', color: mutedColor }}>
            {t.statsOutOf(total)}
          </span>
        </div>
      </div>

      {/* ─── 2 mini-cards additionnelles : portions moyennes + diversité ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{
          padding: '12px 14px', borderRadius: '12px',
          border: `1px solid ${border}`,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.statsServingsPerMeal}
          </span>
          <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 800, color: textColor, lineHeight: 1.1 }}>
            {avgServings}
          </span>
          <span style={{ fontSize: '11px', color: mutedColor }}>
            {t.statsOnAverage}
          </span>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: '12px',
          border: `1px solid ${border}`,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.40)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t.statsDiversity}
          </span>
          <span style={{ fontSize: isMobile ? '22px' : '24px', fontWeight: 800, color: textColor, lineHeight: 1.1 }}>
            {diversityPct}%
          </span>
          <span style={{ fontSize: '11px', color: mutedColor }}>
            {diversityPct >= 75
              ? t.statsDiversityHigh
              : diversityPct >= 40
                ? t.statsDiversityMid
                : t.statsDiversityLow}
          </span>
        </div>
      </div>

      {/* ─── Pills compactes : mois actif + pays favori + jour de semaine ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {bestMonth && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            fontSize: '12px', color: textColor,
          }}>
            <span style={{ color: mutedColor, fontWeight: 600 }}>{t.statsBestMonth} :</span>
            <strong>{t.monthsLong[bestMonth.month - 1]}</strong>
            <span style={{ color: mutedColor }}>({t.statsCookedTimes(bestMonth.count)})</span>
          </span>
        )}
        {topDayCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            fontSize: '12px', color: textColor,
          }}>
            <span style={{ color: mutedColor, fontWeight: 600 }}>{t.statsTopDay} :</span>
            <strong style={{ textTransform: 'capitalize' }}>{topDayName}</strong>
            <span style={{ color: mutedColor }}>({t.statsCookedTimes(topDayCount)})</span>
          </span>
        )}
        {bestCountry && countries?.[bestCountry.country] && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            fontSize: '12px', color: textColor,
          }}>
            <span style={{ color: mutedColor, fontWeight: 600 }}>{t.statsTopCountry} :</span>
            <span>{countries[bestCountry.country].flag ?? '🌍'}</span>
            <strong>{countries[bestCountry.country].names?.[lang] ?? countries[bestCountry.country].names?.fr ?? bestCountry.country}</strong>
            <span style={{ color: mutedColor }}>({t.statsCookedTimes(bestCountry.count)})</span>
          </span>
        )}
      </div>

      {/* ─── Bar chart avec toggle vues (jour/semaine/mois/an) + axe Y ─── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700, color: textColor, margin: 0 }}>
            {view === 'day' ? t.statsLast7Days
              : view === 'week' ? t.statsLast12Weeks
              : view === 'year' ? t.statsLast5Years
              : t.statsLast6Months}
          </p>
          <p style={{ fontSize: '11px', color: mutedColor, margin: 0 }}>
            {t.statsRecipesCooked}
          </p>
        </div>

        {/* v3.412 PR-E — toggle vues (jour/semaine/mois/an) */}
        <div style={{ marginBottom: '12px' }}>
          <SegmentedControl
            options={[
              { value: 'day',   label: t.statsViewDay },
              { value: 'week',  label: t.statsViewWeek },
              { value: 'month', label: t.statsViewMonth },
              { value: 'year',  label: t.statsViewYear },
            ]}
            value={view}
            onChange={setView}
            aria-label={t.statsPeriod}
          />
        </div>

        {/* Graduations Y + barres */}
        <div style={{ display: 'flex', gap: '8px', height: '140px' }}>
          {/* v3.412 PR-E — axe Y dynamique. Si max ≤ 1, on saute le milieu
              (sinon « 1 1 0 » qui n'a aucun sens). */}
          {(() => {
            const yMid = Math.round(chartMax / 2)
            const showMid = yMid > 0 && yMid < chartMax
            return (
              <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                paddingBottom: '20px',
                fontSize: '10px', fontWeight: 600, color: mutedColor,
                textAlign: 'right', minWidth: '20px',
              }}>
                <span>{chartMax}</span>
                {showMid && <span>{yMid}</span>}
                <span>0</span>
              </div>
            )
          })()}

          {/* Barres */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '6px', position: 'relative' }}>
            {/* Lignes de grille (3 lignes horizontales) */}
            <div aria-hidden="true" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: '20px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  borderTop: `1px dashed ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  width: '100%',
                }} />
              ))}
            </div>

            {chartData.map((b) => {
              const heightPct = (b.count / chartMax) * 100
              // v3.412 PR-E — title + label adaptés à la vue active
              const titleTxt = view === 'day'
                ? `${b.date.getDate()} ${t.monthsLong[b.date.getMonth()].slice(0, 4)}. ${b.date.getFullYear()} · ${b.count} ${t.statsRecipesCount(b.count)}`
                : view === 'week'
                  ? `${t.statsWeekOf} ${b.weekStart.getDate()}/${b.weekStart.getMonth() + 1} · ${b.count}`
                  : view === 'year'
                    ? `${b.year} · ${b.count}`
                    : `${t.monthsLong[b.month - 1]} ${b.year} · ${b.count}`
              return (
                // v3.410 fix : height: '100%' indispensable (cf. spending-dashboard pattern).
                <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0, position: 'relative', height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      title={titleTxt}
                      style={{
                        width: '100%',
                        height: b.count > 0 ? `${Math.max(8, heightPct)}%` : '2px',
                        // v3.410 — bumpé saturation en dark + box-shadow
                        // glow orange pour visibilité accrue sur fond foncé.
                        // Light mode garde le gradient brand original.
                        background: b.count > 0
                          ? (darkMode
                            ? 'linear-gradient(180deg, #FFB366 0%, #FF7B14 100%)'
                            : 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)')
                          : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                        boxShadow: b.count > 0
                          ? (darkMode
                            ? '0 0 12px rgba(255,140,40,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
                            : '0 2px 8px rgba(212,106,16,0.32)')
                          : 'none',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.3s ease',
                        position: 'relative',
                      }}
                    >
                      {b.count > 0 && (
                        <span style={{
                          position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)',
                          fontSize: '11px', fontWeight: 700, color: textColor, whiteSpace: 'nowrap',
                        }}>
                          {b.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: mutedColor,
                    whiteSpace: 'nowrap', overflow: 'visible',
                  }}>
                    {/* v3.412 PR-E — label axe X selon la vue (7 jours tiennent tous) */}
                    {view === 'day' && `${b.date.getDate()} ${t.monthsShort?.[b.date.getMonth()] ?? ''}`}
                    {view === 'week' && (() => {
                      const target = new Date(b.weekStart.valueOf())
                      const dayNr = (b.weekStart.getDay() + 6) % 7
                      target.setDate(target.getDate() - dayNr + 3)
                      const firstThursday = new Date(target.getFullYear(), 0, 4)
                      const w = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000))
                      return t.statsWeekPrefix + w
                    })()}
                    {view === 'year' && b.year}
                    {view === 'month' && (t.monthsShort?.[b.month - 1] ?? b.month)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── Podium top recettes ────────────────────────────────────── */}
      {top.length > 0 && (
        <div>
          <p style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700, color: textColor, margin: '0 0 12px' }}>
            {t.statsTopRecipes}
          </p>

          {/* Podium top 3 (visuel distinct) */}
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {top.slice(0, 3).map((r, i) => {
              const { emoji, name } = resolveRecipe(r.recipe_id, r.recipe_source)
              const medals = ['🥇', '🥈', '🥉']
              const podiumBg = [
                darkMode ? 'rgba(255,215,0,0.08)'  : 'rgba(255,215,0,0.10)',
                darkMode ? 'rgba(192,192,192,0.08)' : 'rgba(192,192,192,0.10)',
                darkMode ? 'rgba(205,127,50,0.08)' : 'rgba(205,127,50,0.10)',
              ][i]
              return (
                <li key={r.recipe_id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '12px',
                  border: `1px solid ${border}`,
                  background: podiumBg,
                }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{medals[i]}</span>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: mutedColor, whiteSpace: 'nowrap' }}>
                    {t.statsCookedTimes(r.count)}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Reste : liste discrète si > 3 */}
          {top.length > 3 && (
            <ol start={4} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {top.slice(3).map((r, i) => {
                const { emoji, name } = resolveRecipe(r.recipe_id, r.recipe_source)
                return (
                  <li key={r.recipe_id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '6px 12px', borderRadius: '8px',
                    fontSize: '13px',
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, minWidth: '20px', textAlign: 'center' }}>#{i + 4}</span>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{emoji}</span>
                    <span style={{ flex: 1, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ fontSize: '11px', color: mutedColor, whiteSpace: 'nowrap' }}>{t.statsCookedTimes(r.count)}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
