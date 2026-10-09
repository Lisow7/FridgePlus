import { useState, useEffect, useCallback } from 'react'
import {
  LuUsers, LuChefHat, LuMessageSquare, LuCarrot, LuRefreshCw,
  LuDatabase, LuBan, LuShield, LuActivity, LuArrowRight, LuTriangleAlert, } from 'react-icons/lu'
import { useAdmin } from '../providers/admin-provider'
import { ADMIN_I18N } from '../i18n/admin-i18n'
import { adminGetLogs } from '@features/admin/api/admin'
import StatCard from './shared/stat-card'
import AnalyticsChart from './shared/analytics-chart'
import Button from '@shared/ui/button'

// ── Action labels pour le mini-journal ───────────────────────────────────────

const ACTION_COLORS = {
  recipe_approved:     'var(--color-success)',
  recipe_rejected:     'var(--color-danger)',
  recipe_pending:      'var(--color-warning)',
  recipe_submitted:    'var(--color-warning)',
  recipe_deleted:      'var(--color-danger)',
  recipe_edited:       'var(--color-info)',
  user_banned:         'var(--color-danger)',
  user_unbanned:       'var(--color-success)',
  account_deleted:     '#EF4444',
  ingredient_added:    'var(--color-success)',
  ingredient_updated:  'var(--color-info)',
  ingredient_deleted:  'var(--color-danger)',
  base_recipe_added:   'var(--color-success)',
  base_recipe_updated: 'var(--color-info)',
  base_recipe_deleted: 'var(--color-danger)',
}

const ACTION_LABELS_FR = {
  recipe_approved:        'Recette approuvée',
  recipe_rejected:        'Recette rejetée',
  recipe_pending:         'Recette remise en attente',
  recipe_submitted:       'Recette soumise',
  recipe_deleted:         'Recette supprimée',
  recipe_edited:          'Recette modifiée',
  user_banned:            'Utilisateur banni',
  user_unbanned:          'Utilisateur débanni',
  account_deleted:        'Compte supprimé',
  account_soft_deleted:   'Compte supprimé',
  account_restored:       'Compte restauré',
  account_anonymized:     'Compte anonymisé',
  recipe_promoted:        'Recette promue au catalogue',
  ingredient_added:       'Ingrédient ajouté',
  ingredient_updated:     'Ingrédient modifié',
  ingredient_deleted:     'Ingrédient supprimé',
  base_recipe_added:      'Recette catalogue ajoutée',
  base_recipe_updated:    'Recette catalogue modifiée',
  base_recipe_deleted:    'Recette catalogue supprimée',
  sensitive_data_accessed:'Données sensibles consultées',
  ticket_replied:         'Ticket — réponse envoyée',
  ticket_deleted:         'Ticket supprimé',
  ticket_message_deleted: 'Message de ticket supprimé',
  report_resolved:        'Signalement résolu',
  report_rejected:        'Signalement rejeté',
  user_role_updated:      'Rôle utilisateur mis à jour',
  user_promoted:          'Utilisateur promu',
  community_post_deleted:  'Post communauté supprimé',
  community_post_purged:   'Post communauté purgé',
  community_reply_deleted: 'Réponse communauté supprimée',
  community_reply_purged:  'Réponse communauté purgée',
  community_user_muted:    'Utilisateur réduit au silence',
  community_user_unmuted:  'Utilisateur réactivé',
  recipe_review_deleted:   'Avis supprimé',
  recipe_review_purged:    'Avis purgé',
  profile_data_viewed:     'Données de profil consultées',
  profile_data_exported:   'Données de profil exportées',
}

function fmtDate(str) {
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
  const bg     = darkMode ? `${color}18` : `${color}12`
  const border = `${color}33`
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${color}22` }}
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
      <span style={{ width:32, height:32, borderRadius:8, background:`${color}22`, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color }}>{count} {label}</div>
      </div>
      <LuArrowRight size={14} style={{ color, flexShrink:0, opacity:0.7 }} />
    </Button>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ lang = 'fr', darkMode = false }) {
  const t = ADMIN_I18N[lang] ?? ADMIN_I18N.fr
  const { stats, statsLoading, refreshStats, setSection, pendingCount, supportBadge, healthCount, reportsCount } = useAdmin()

  const [recentLogs,    setRecentLogs]    = useState([])
  const [logsLoading,   setLogsLoading]   = useState(false)
  const [refreshKey,    setRefreshKey]    = useState(0)

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await adminGetLogs(0)
    setRecentLogs((data ?? []).slice(0, 10))
    setLogsLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadLogs() }, [loadLogs])

  function handleRefresh() {
    refreshStats()
    loadLogs()
    setRefreshKey(k => k + 1)
  }

  const muted    = darkMode ? '#A0A8B8' : '#7A6A52'
  const fg       = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const border   = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const cardBg   = darkMode ? '#1A2F48' : '#FFFFFF'
  const groupLbl = darkMode ? '#4A6080' : '#9A8070'

  const isFr = lang === 'fr'

  // Actions urgentes visibles
  const urgentActions = [
    pendingCount  > 0 && { icon:<LuChefHat size={16}/>,     label: isFr ? `recette${pendingCount>1?'s':''} à modérer`  : `recipe${pendingCount>1?'s':''} to review`,   count:pendingCount,  color:'var(--color-brand-500)',  onClick:() => setSection('recipes') },
    supportBadge  > 0 && { icon:<LuMessageSquare size={16}/>,label: isFr ? `ticket${supportBadge>1?'s':''} non lu${supportBadge>1?'s':''}` : `unread ticket${supportBadge>1?'s':''}`, count:supportBadge, color:'var(--color-info)',  onClick:() => setSection('support') },
    reportsCount  > 0 && { icon:<LuBan size={16}/>,          label: isFr ? `signalement${reportsCount>1?'s':''} ouvert${reportsCount>1?'s':''}` : `open report${reportsCount>1?'s':''}`,  count:reportsCount, color:'var(--color-danger)',  onClick:() => setSection('reports') },
    healthCount   > 0 && { icon:<LuShield size={16}/>,       label: isFr ? `problème${healthCount>1?'s':''} qualité`    : `quality issue${healthCount>1?'s':''}`,          count:healthCount,  color:'var(--color-warning)',  onClick:() => setSection('quality') },
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
          <LuRefreshCw size={13} style={{ animation: (statsLoading || logsLoading) ? 'spin 1s linear infinite' : 'none' }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          {t.refresh}
        </Button>
      </div>

      {/* ── Quick Actions (urgences) ── */}
      {urgentActions.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <LuTriangleAlert size={13} style={{ color:'var(--color-warning)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:groupLbl, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              {isFr ? 'Actions requises' : 'Action required'}
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
      <div style={{ display:'grid', gap:10, gridTemplateColumns:'repeat(3, 1fr)' }}>
        <StatCard icon={<LuUsers size={15}/>}       label={t.kpiUsers}          value={stats.usersCount ?? '—'}       accent="#5A7AAA" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('users')} />
        <StatCard icon={<LuChefHat size={15}/>}     label={t.kpiRecipesPending} value={stats.recipesPending ?? '—'}   accent="var(--color-brand-500)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('recipes')} />
        <StatCard icon={<LuMessageSquare size={15}/>} label={t.kpiTicketsOpen}  value={stats.ticketsOpen ?? '—'}      accent="var(--color-info)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('support')} />
        <StatCard icon={<LuCarrot size={15}/>}      label={t.kpiIngredients}    value={stats.ingredientsCount ?? '—'} accent="#5A8A4A" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('ingredients')} />
        <StatCard icon={<LuDatabase size={15}/>}    label={t.kpiBaseRecipes}    value={stats.baseRecipesCount ?? '—'} accent="#7C5CAF" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('base')} />
        <StatCard icon={<LuBan size={15}/>}         label={isFr ? 'Signalements' : 'Reports'} value={reportsCount ?? '—'} accent="var(--color-danger)" loading={statsLoading} darkMode={darkMode} onClick={() => setSection('reports')} />
      </div>

      {/* ── Activité récente ── */}
      <div style={{ display:'grid', gap:16, gridTemplateColumns:'1fr' }}>

        {/* Activité récente (le rail latéral assure la navigation — plus de tuiles redondantes) */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <LuActivity size={12} style={{ color:muted }} />
              <span style={{ fontSize:10, fontWeight:700, color:groupLbl, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                {isFr ? 'Activité récente' : 'Recent activity'}
              </span>
            </div>
            {recentLogs.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSection('journal')}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-brand-500)'}
                onMouseLeave={e => e.currentTarget.style.color = muted}
                className="h-auto rounded-none bg-transparent p-0 text-[10px] hover:bg-transparent"
                style={{ gap: 3, color: muted }}
              >
                {isFr ? 'Tout voir' : 'See all'} <LuArrowRight size={10} />
              </Button>
            )}
          </div>

          <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:10, overflowY:'auto', flex:1 }}>
            {logsLoading ? (
              <div style={{ padding:'12px', textAlign:'center', color:muted, fontSize:12 }}>…</div>
            ) : recentLogs.length === 0 ? (
              <div style={{ padding:'12px', textAlign:'center', color:muted, fontSize:12, fontStyle:'italic' }}>
                {isFr ? 'Aucune activité' : 'No activity'}
              </div>
            ) : (
              <div>
                {recentLogs.map((log, i) => {
                  const color = ACTION_COLORS[log.action] ?? muted
                  const label = ACTION_LABELS_FR[log.action] ?? log.action
                  return (
                    <div key={log.id}
                      style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 10px', borderBottom: i < recentLogs.length - 1 ? `1px solid ${border}` : 'none' }}>
                      <span style={{ width:5, height:5, borderRadius:'50%', background:color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11, fontWeight:600, color }}>{label}</div>
                      <div style={{ fontSize:10, color:muted, flexShrink:0 }}>{fmtDate(log.created_at)}</div>
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
