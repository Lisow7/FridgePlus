import { useState } from 'react'
import {
  LuUsers, LuChefHat, LuMessageSquare, LuCarrot, LuRefreshCw,
  LuDatabase, LuBan, LuShield, LuActivity, LuArrowRight, LuTriangleAlert, } from 'react-icons/lu'
import { useAdmin } from '../providers/admin-provider'
import { ADMIN_I18N } from '../i18n/admin-i18n'
import { adminGetLogs } from '@features/admin/api/admin'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import ChargementRate from './shared/chargement-rate'
import { LIBELLES_DU_JOURNAL } from '@features/admin/lib/libelles-du-journal'
import StatCard from './shared/stat-card'
import AnalyticsChart from './shared/analytics-chart'
import Button from '@shared/ui/button'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

// ── Noms et couleurs du mini-journal : le module partagé avec l'onglet
// Journal (audit du 2026-10-04, ADM-06 — chaque écran avait sa table, et
// elles se contredisaient).

function depuis(str) {
  if (!str) return ''
  const d = new Date(str)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  if (diffMin < 1)  return 'à l\'instant'
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24)   return `il y a ${diffH} h`
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })
}

// ── Quick Action card ─────────────────────────────────────────────────────────

function QuickAction({ icon, label, count, color, onClick, darkMode }) {
  // Les couleurs arrivent en variables CSS : `${color}18` donnait une valeur
  // invalide, et ni le fond ni la bordure n'apparaissaient (relevé avec la
  // palette de l'admin, 2026-10-08).
  const bg     = fondTeinte(color, darkMode ? 9 : 7)
  const border = fondTeinte(color, 20)
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${fondTeinte(color, 13)}` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
      className="h-auto justify-start rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-left hover:bg-transparent"
      style={{
        flex: '1 1 auto', minWidth: 180,
        gap: 10,
        background: bg,
        borderColor: border,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
    >
      <span style={{ width:32, height:32, borderRadius:8, background: fondTeinte(color, 13), color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color: texteLisible(color) }}>{count} {label}</div>
      </div>
      <LuArrowRight size={14} style={{ color, flexShrink:0, opacity:0.7 }} />
    </Button>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ lang = 'fr', darkMode = false }) {
  const t = ADMIN_I18N.fr
  const { stats, statsLoading, statsError, refreshStats, setSection, pendingCount, supportBadge, healthCount, reportsCount } = useAdmin()

  const [recentLogs,    setRecentLogs]    = useState([])
  const [refreshKey,    setRefreshKey]    = useState(0)

  // `useReloader` : un `finally` (un chargement bloqué grisait aussi « Actualiser »)
  // et l'échec dit, au lieu d'« Aucune activité » (audit ADM-08, ADM-09).
  const { loading: logsLoading, error: logsError, reload: loadLogs } = useReloader(async (estObsolete) => {
    // Dix lignes, sans comptage exact ni page entière (ADM-12 (4)).
    const { data } = leverSiErreur(await adminGetLogs(0, { limite: 10, compter: false }))
    if (estObsolete()) return
    setRecentLogs(data ?? [])
  }, [])

  function handleRefresh() {
    refreshStats()
    loadLogs()
    setRefreshKey(k => k + 1)
  }

  const muted    = darkMode ? '#A0A8B8' : '#7A6A52'
  const fg       = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border   = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const cardBg   = darkMode ? '#1A2F48' : '#FFFFFF'
  // Titres de groupe : le jeton atténué, lisible dans les deux thèmes (audit
  // A11Y-03 : #9A8070 à 3,5:1 en clair, #4A6080 à 2,1-2,6:1 en sombre).
  const groupLbl = 'var(--color-muted)'


  // Actions urgentes visibles
  const urgentActions = [
    pendingCount  > 0 && { icon:<LuChefHat size={16}/>,     label: `recette${pendingCount>1?'s':''} à modérer`,   count:pendingCount,  color:'var(--color-brand-500)',  onClick:() => setSection('recipes') },
    supportBadge  > 0 && { icon:<LuMessageSquare size={16}/>,label: `ticket${supportBadge>1?'s':''} non lu${supportBadge>1?'s':''}`, count:supportBadge, color:'var(--color-info)',  onClick:() => setSection('support') },
    reportsCount  > 0 && { icon:<LuBan size={16}/>,          label: `signalement${reportsCount>1?'s':''} ouvert${reportsCount>1?'s':''}`,  count:reportsCount, color:'var(--color-danger)',  onClick:() => setSection('reports') },
    healthCount   > 0 && { icon:<LuShield size={16}/>,       label: `problème${healthCount>1?'s':''} qualité`,          count:healthCount,  color:'var(--color-warning)',  onClick:() => setSection('quality') },
  ].filter(Boolean)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, height:'100%' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0, color:fg }}>{t.dashboardTitle}</h2>
          <p style={{ fontSize:13, color:muted, margin:'3px 0 0' }}>{t.dashboardSub}</p>
        </div>
        <Button
          variant="ghost"
          onClick={handleRefresh}
          disabled={statsLoading || logsLoading}
          className="h-auto flex-shrink-0 rounded-lg border bg-transparent px-3 py-1.5 text-xs font-semibold hover:bg-transparent"
          style={{ gap: 6, borderColor: border, color: fg }}
        >
          <LuRefreshCw size={13} className={(statsLoading || logsLoading) ? 'animate-spin' : undefined} />
          {t.refresh}
        </Button>
      </div>

      {/* ── Quick Actions (urgences) ── */}
      {urgentActions.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <LuTriangleAlert size={13} style={{ color:'var(--color-warning)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:groupLbl, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              {'Actions requises'}
            </span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {urgentActions.map((a, i) => (
              <QuickAction key={i} {...a} darkMode={darkMode} />
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Grid ── */}
      {statsError && (
        <ChargementRate message={'Les compteurs n\'ont pas pu être chargés.'} error={statsError} onRetry={refreshStats} lang={lang} />
      )}
      {/* Deux colonnes sous 640 px : à trois, une carte faisait 99 px et ses
          libellés débordaient (« UTILISATEURS » : 82 px pour 29). */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard icon={<LuUsers size={15}/>}       label={t.kpiUsers}          value={stats.usersCount ?? '—'}       accent="#5A7AAA" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('users')} />
        <StatCard icon={<LuChefHat size={15}/>}     label={t.kpiRecipesPending} value={stats.recipesPending ?? '—'}   accent="var(--color-brand-500)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('recipes')} />
        <StatCard icon={<LuMessageSquare size={15}/>} label={t.kpiTicketsOpen}  value={stats.ticketsOpen ?? '—'}      accent="var(--color-info)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('support')} />
        <StatCard icon={<LuCarrot size={15}/>}      label={t.kpiIngredients}    value={stats.ingredientsCount ?? '—'} accent="#5A8A4A" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('ingredients')} />
        <StatCard icon={<LuDatabase size={15}/>}    label={t.kpiBaseRecipes}    value={stats.baseRecipesCount ?? '—'} accent="#7C5CAF" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('base')} />
        <StatCard icon={<LuBan size={15}/>}         label={'Signalements'} value={statsError ? '—' : (reportsCount ?? '—')} accent="var(--color-danger)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('reports')} />
      </div>

      {/* ── Activité récente ── */}
      <div style={{ display:'grid', gap:16, gridTemplateColumns:'1fr' }}>

        {/* Activité récente (le rail latéral assure la navigation — plus de tuiles redondantes) */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <LuActivity size={12} style={{ color:muted }} />
              <span style={{ fontSize:10, fontWeight:700, color:groupLbl, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                {'Activité récente'}
              </span>
            </div>
            {recentLogs.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSection('journal')}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-brand-500)'}
                onMouseLeave={e => e.currentTarget.style.color = muted}
                className="h-auto min-h-6 rounded-none bg-transparent px-1 py-0 text-[10px] hover:bg-transparent"
                style={{ gap: 3, color: muted }}
              >
                {'Tout voir'} <LuArrowRight size={10} />
              </Button>
            )}
          </div>

          <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:10, overflowY:'auto', flex:1 }}>
            {logsLoading ? (
              <div style={{ padding:'12px', textAlign:'center', color:muted, fontSize:12 }}>…</div>
            ) : logsError ? (
              <div style={{ padding:'0 12px' }}><ChargementRate error={logsError} onRetry={loadLogs} lang={lang} /></div>
            ) : recentLogs.length === 0 ? (
              <div style={{ padding:'12px', textAlign:'center', color:muted, fontSize:12, fontStyle:'italic' }}>
                {'Aucune activité'}
              </div>
            ) : (
              <div>
                {recentLogs.map((log, i) => {
                  const fiche = LIBELLES_DU_JOURNAL[log.action]
                  const color = fiche?.color ?? muted
                  const label = fiche?.label ?? log.action
                  return (
                    <div key={log.id}
                      style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderBottom: i < recentLogs.length - 1 ? `1px solid ${border}` : 'none' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11, fontWeight:600, color: texteLisible(color) }}>{label}</div>
                      <div style={{ fontSize:10, color:muted, flexShrink:0 }}>{depuis(log.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Analytics pleine largeur — remplit l'espace restant ── */}
      <div style={{ flex:1, minHeight:0 }}>
        <AnalyticsChart darkMode={darkMode} refreshKey={refreshKey} />
      </div>

    </div>
  )
}
