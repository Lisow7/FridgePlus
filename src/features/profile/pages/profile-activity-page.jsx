import { useOutletContext, Link } from 'react-router-dom'
import { LuChartBar, LuBookOpen } from 'react-icons/lu'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useCookingLogs } from '@features/profile/hooks/use-cooking-logs'
import ProfileLoadError from '@features/profile/components/profile-load-error'
import ProfilePageIntro from '@features/profile/components/profile-page-intro'
import ProfileSection  from '@features/profile/components/profile-section'
import CookingStatsSection from '@features/profile/components/cooking-stats-section'
// v3.412 PR-E — SpendingDashboard + Subscription/Upgrade retirés
// (section migrée vers /profile/depenses page dédiée).

// Sprint 11 S11.a.4 — sous-page /profile/activite.
// Vue d'ensemble stats + journal cuisine + dépenses (Premium gated).

const I18N = {
  fr: {
    pageTitle: 'Activité',
    pageIntro: 'Tes habitudes cuisine et tes dépenses au fil du temps.',
    statsSectionTitle: 'Vue d\'ensemble',
    statsSectionDesc:  'Tes stats à un coup d\'œil.',
    journalTitle: 'Journal de cuisine',
    journalDesc:  'Les 20 dernières recettes que tu as cuisinées.',
    journalEmpty: 'Quand tu cliques « J\'ai cuisiné cette recette », elle apparait ici.',
    journalUnknown: 'Recette inconnue',
    journalServings: (n) => n === 1 ? '1 portion' : `${n} portions`,
    // v3.412 PR-E — i18n spending déplacé vers profile-spending-page.
    // (séries + badges déplacés vers profile-rewards-page / onglet Récompenses.)
    // ── i18n object pour CookingStatsSection ──────────────────────────
    statsTitle:        'Tes statistiques de cuisine',
    statsSub:          'Calculées à partir de ton journal de cuisine, mises à jour à chaque ouverture.',
    statsEmpty:        'Aucune statistique pour l\'instant. Cuisine quelques recettes pour voir apparaître ton activité ici.',
    statsTotalCooked:  'Recettes cuisinées au total',
    statsThisMonth:    'Ce mois-ci',
    statsUnique:       'Recettes différentes',
    statsTopRecipes:   'Tes recettes préférées',
    statsLast6Months:  '6 derniers mois',
    statsTopCountry:   'Pays le plus cuisiné',
    statsBestMonth:    'Mois le plus actif',
    statsCookedTimes:  (n) => n === 1 ? '1 fois' : `${n} fois`,
    monthsLong:        ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    monthsShort:       ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
    // Journal : abréviations à la française (minuscules + point), distinctes de
    // `monthsShort` ci-dessus qui sert aux axes de graphes.
    journalToday:      'Aujourd\'hui',
    journalYesterday:  'Hier',
    journalDaysAgo:    (n) => `Il y a ${n} jours`,
    journalMonthsShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    statsRecipesCount:   (n) => n === 1 ? 'recette' : 'recettes',
    statsSameAsLastMonth: 'identique au mois dernier',
    statsVsLastMonth:    'vs mois dernier',
    statsNew:            'nouveau',
    statsOutOf:          (n) => `sur ${n} cuisinées`,
    statsServingsPerMeal: 'Portions par repas',
    statsOnAverage:      'en moyenne',
    statsDiversity:      'Diversité',
    statsDiversityHigh:  'tu varies beaucoup',
    statsDiversityMid:   'équilibré',
    statsDiversityLow:   'tu aimes tes classiques',
    statsTopDay:         'Jour favori',
    statsLast7Days:      '7 derniers jours',
    statsLast12Weeks:    '12 dernières semaines',
    statsLast5Years:     '5 dernières années',
    statsRecipesCooked:  'Recettes cuisinées',
    statsViewDay:        'Jour',
    statsViewWeek:       'Semaine',
    statsViewMonth:      'Mois',
    statsViewYear:       'Année',
    statsPeriod:         'Période',
    statsWeekOf:         'Sem. du',
    statsWeekPrefix:     'S',
  },
  en: {
    pageTitle: 'Activity',
    pageIntro: 'Your cooking habits and spending over time.',
    statsSectionTitle: 'Overview',
    statsSectionDesc:  'Your stats at a glance.',
    journalTitle: 'Cooking journal',
    journalDesc:  'Your last 20 cooked recipes.',
    journalEmpty: 'When you click « I cooked this recipe », it appears here.',
    journalUnknown: 'Unknown recipe',
    journalServings: (n) => n === 1 ? '1 serving' : `${n} servings`,
    // v3.412 PR-E — i18n spending moved to profile-spending-page.
    // (streaks + badges moved to profile-rewards-page / Rewards tab.)
    statsTitle:        'Your cooking stats',
    statsSub:          'Computed from your cooking journal, refreshed each time you open this tab.',
    statsEmpty:        'No stats yet. Cook a few recipes to see your activity appear here.',
    statsTotalCooked:  'Total recipes cooked',
    statsThisMonth:    'This month',
    statsUnique:       'Unique recipes',
    statsTopRecipes:   'Your favorite recipes',
    statsLast6Months:  'Last 6 months',
    statsTopCountry:   'Most cooked country',
    statsBestMonth:    'Most active month',
    statsCookedTimes:  (n) => n === 1 ? '1 time' : `${n} times`,
    monthsLong:        ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort:       ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    journalToday:      'Today',
    journalYesterday:  'Yesterday',
    journalDaysAgo:    (n) => `${n} days ago`,
    journalMonthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    statsRecipesCount:   (n) => n === 1 ? 'recipe' : 'recipes',
    statsSameAsLastMonth: 'same as last month',
    statsVsLastMonth:    'vs last month',
    statsNew:            'new',
    statsOutOf:          (n) => `out of ${n} cooked`,
    statsServingsPerMeal: 'Servings per meal',
    statsOnAverage:      'on average',
    statsDiversity:      'Diversity',
    statsDiversityHigh:  'lots of variety',
    statsDiversityMid:   'balanced',
    statsDiversityLow:   'you love your classics',
    statsTopDay:         'Top day',
    statsLast7Days:      'Last 7 days',
    statsLast12Weeks:    'Last 12 weeks',
    statsLast5Years:     'Last 5 years',
    statsRecipesCooked:  'Recipes cooked',
    statsViewDay:        'Day',
    statsViewWeek:       'Week',
    statsViewMonth:      'Month',
    statsViewYear:       'Year',
    statsPeriod:         'Period',
    statsWeekOf:         'Week of',
    statsWeekPrefix:     'W',
  },
}

export default function ProfileActivityPage() {
  const { lang = 'fr', darkMode = false, user } = useOutletContext()
  const t = I18N[lang] ?? I18N.fr
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640
  // Source unique des logs + dérivés (partagée avec /profile/recompenses).
  const {
    baseRecipes, recipeNames, countries, customRecipes,
    journalLogs, statsLogs, cleanJournalLogs, cleanStatsLogs,
    journalError, statsError, reloadCookingLogs,
  } = useCookingLogs(user?.id)

  const textColor  = darkMode ? '#EBE4D8' : '#2d1b00'
  const mutedColor = darkMode ? '#7A90A8' : '#6A4F45'
  const border     = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  return (
    <>
      <ProfilePageIntro title={t.pageTitle} description={t.pageIntro} darkMode={darkMode} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProfileSection
          Icon={LuChartBar}
          title={t.statsSectionTitle}
          description={t.statsSectionDesc}
          lang={lang}
          darkMode={darkMode}
        >
          {/* Trois écrans différents : pas chargé, en cours, chargé. Avant, les
              deux premiers montraient « Aucune statistique pour l'instant ». */}
          {statsError ? (
            <ProfileLoadError lang={lang} onRetry={reloadCookingLogs} textColor={textColor} mutedColor={mutedColor} />
          ) : statsLogs === null ? (
            <p style={{ fontSize: '13px', color: mutedColor, margin: 0 }}>…</p>
          ) : (
            <CookingStatsSection
              logs={cleanStatsLogs}
              t={t}
              lang={lang}
              isMobile={isMobile}
              darkMode={darkMode}
              border={border}
              textColor={textColor}
              mutedColor={mutedColor}
              baseRecipes={baseRecipes}
              baseRecipeNames={recipeNames}
              customRecipes={customRecipes}
              countries={countries}
            />
          )}
        </ProfileSection>

        <ProfileSection
          Icon={LuBookOpen}
          title={t.journalTitle}
          description={t.journalDesc}
          lang={lang}
          darkMode={darkMode}
        >
          {journalError ? (
            <ProfileLoadError lang={lang} onRetry={reloadCookingLogs} textColor={textColor} mutedColor={mutedColor} />
          ) : journalLogs === null ? (
            <p style={{ fontSize: '13px', color: mutedColor, margin: 0 }}>…</p>
          ) : cleanJournalLogs.length === 0 ? (
            <p style={{ fontSize: '13px', color: mutedColor, margin: 0, fontStyle: 'italic' }}>
              {t.journalEmpty}
            </p>
          ) : (
            (() => {
              // Sprint 11 — grouper le journal par mois (« Mai 2026 ») pour
              // navigation rapide. Date enrichie : « Aujourd'hui » / « Hier »
              // badges pour les logs récents, sinon date courte.
              const monthLabels = t.monthsLong
              const now = new Date()
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
              const dayMs = 86400000

              const formatLogDate = (iso) => {
                const d = new Date(iso)
                if (Number.isNaN(d.getTime())) return ''
                const logDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
                const daysAgo = Math.round((today - logDay) / dayMs)
                if (daysAgo === 0) return { label: t.journalToday, highlight: true }
                if (daysAgo === 1) return { label: t.journalYesterday, highlight: true }
                if (daysAgo < 7) return { label: t.journalDaysAgo(daysAgo), highlight: false }
                // Au-delà : date courte « 4 mai » (sans année si année courante)
                const sameYear = d.getFullYear() === now.getFullYear()
                const monthsShort = t.journalMonthsShort
                return {
                  label: sameYear
                    ? `${d.getDate()} ${monthsShort[d.getMonth()]}`
                    : `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`,
                  highlight: false,
                }
              }

              const groups = []
              for (const log of cleanJournalLogs) {
                const d = new Date(log.cooked_at)
                if (Number.isNaN(d.getTime())) continue  // skip logs avec date invalide
                const key = `${d.getFullYear()}-${d.getMonth()}`
                const label = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`
                let group = groups.find((g) => g.key === key)
                if (!group) {
                  group = { key, label, logs: [] }
                  groups.push(group)
                }
                group.logs.push(log)
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {groups.map((group) => (
                    <div key={group.key}>
                      <p style={{
                        margin: '0 0 8px',
                        fontSize: '11px', fontWeight: 700,
                        color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {group.label} <span style={{ fontWeight: 600, opacity: 0.7 }}>· {group.logs.length}</span>
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {group.logs.map((log) => {
                          // v3.410 — résolution unifiée custom + base.
                          // Les orphelins ont déjà été filtrés par
                          // cleanJournalLogs en amont (cf. isOrphanLog).
                          // isUnknown ici = défensif (cas edge race).
                          let name, emoji
                          if (log.recipe_source === 'custom') {
                            const r = customRecipes.find(c => c.id === log.recipe_id)
                            name = r?.name ?? t.journalUnknown
                            emoji = r?.emoji ?? '🍽️'
                          } else {
                            const baseRecipe = baseRecipes?.find?.((r) => r.id === log.recipe_id)
                            const baseName = recipeNames?.[log.recipe_id]
                            emoji = baseRecipe?.emoji ?? '🍽️'
                            name = baseName?.[lang] ?? baseName?.fr ?? t.journalUnknown
                          }
                          const isUnknown = name === t.journalUnknown
                          const dateInfo = formatLogDate(log.cooked_at)
                          const rowStyle = {
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 12px', borderRadius: '8px',
                            background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            gap: '8px', flexWrap: 'wrap',
                            color: isUnknown ? mutedColor : textColor,
                            textDecoration: 'none',
                            transition: 'background 0.15s',
                            opacity: isUnknown ? 0.65 : 1,
                          }
                          const rowContent = (
                            <>
                              <span style={{ fontSize: '13px', color: isUnknown ? mutedColor : textColor, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span aria-hidden="true">{emoji}</span>
                                {name}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: mutedColor }}>
                                <span style={{
                                  padding: dateInfo.highlight ? '2px 8px' : 0,
                                  borderRadius: '4px',
                                  background: dateInfo.highlight ? 'rgba(247,168,94,0.18)' : 'transparent',
                                  color: dateInfo.highlight ? 'var(--color-warm-600)' : mutedColor,
                                  fontWeight: dateInfo.highlight ? 700 : 500,
                                }}>
                                  {dateInfo.label}
                                </span>
                                <span style={{ opacity: 0.6 }}>·</span>
                                <span>{t.journalServings(log.servings)}</span>
                              </span>
                            </>
                          )
                          return (
                            <li key={log.id} style={{ listStyle: 'none' }}>
                              {isUnknown ? (
                                <div style={rowStyle}>{rowContent}</div>
                              ) : (
                                <Link
                                  to={`/recipe/${log.recipe_id}`}
                                  style={rowStyle}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(247,168,94,0.10)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
                                >
                                  {rowContent}
                                </Link>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </ProfileSection>

        {/* v3.412 PR-E — section « Mes dépenses » DÉPLACÉE vers sa propre
            sous-route /profile/depenses (Premium-gated). Permet de
            développer l'analytics sans noyer la page Activité. */}
      </div>
    </>
  )
}
