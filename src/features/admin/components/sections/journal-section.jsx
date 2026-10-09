import { useState, useMemo } from 'react'
import { LuSearch } from 'react-icons/lu'
import {
  adminGetLogs, adminGetRecipesByIds, adminGetUsersByIds,
} from '@features/admin/api/admin'
import AvatarImg from '@shared/ui/avatar-img'
import { ADMIN_I18N } from '../../i18n/admin-i18n'
import FilterPill from '@shared/ui/filter-pill'
import EmptyState from '@shared/ui/empty-state'
import Pagination from '@shared/ui/pagination'
import { formatDateTime } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'

const PER_PAGE = 50

const ACTION_LABELS = {
  recipe_approved:          { label: 'Recette approuvée',              color: 'var(--color-success)', group: 'Recettes' },
  recipe_rejected:          { label: 'Recette rejetée',                color: 'var(--color-danger)', group: 'Recettes' },
  recipe_pending:           { label: 'Recette remise en attente',      color: 'var(--color-warning)', group: 'Recettes' },
  recipe_submitted:         { label: 'Recette soumise',                color: 'var(--color-warning)', group: 'Recettes' },
  recipe_deleted:           { label: 'Recette supprimée',              color: 'var(--color-danger)', group: 'Recettes' },
  recipe_edited:            { label: 'Recette modifiée',               color: 'var(--color-info)', group: 'Recettes' },
  user_banned:              { label: 'Utilisateur banni',              color: 'var(--color-danger)', group: 'Utilisateurs' },
  user_unbanned:            { label: 'Utilisateur débanni',            color: 'var(--color-success)', group: 'Utilisateurs' },
  account_deleted:          { label: 'Compte supprimé',                color: '#EF4444', group: 'Utilisateurs' },
  ingredient_added:         { label: 'Ingrédient ajouté',              color: 'var(--color-success)', group: 'Données' },
  ingredient_updated:       { label: 'Ingrédient modifié',             color: 'var(--color-info)', group: 'Données' },
  ingredient_deleted:       { label: 'Ingrédient supprimé',            color: 'var(--color-danger)', group: 'Données' },
  base_recipe_added:        { label: 'Recette base ajoutée',           color: 'var(--color-success)', group: 'Données' },
  base_recipe_updated:      { label: 'Recette base modifiée',          color: 'var(--color-info)', group: 'Données' },
  base_recipe_deleted:      { label: 'Recette base supprimée',         color: 'var(--color-danger)', group: 'Données' },
  community_post_deleted:   { label: 'Post communauté masqué',         color: 'var(--color-danger)', group: 'Communauté' },
  community_post_purged:    { label: 'Post communauté supprimé',       color: '#7F1D1D', group: 'Communauté' },
  community_reply_deleted:  { label: 'Réponse communauté masquée',     color: 'var(--color-danger)', group: 'Communauté' },
  community_reply_purged:   { label: 'Réponse communauté supprimée',   color: '#7F1D1D', group: 'Communauté' },
  community_user_muted:     { label: 'Utilisateur muté (communauté)',  color: 'var(--color-warning)', group: 'Communauté' },
  community_user_unmuted:   { label: 'Mute levé (communauté)',         color: 'var(--color-success)', group: 'Communauté' },
  recipe_review_deleted:    { label: 'Avis masqué',                    color: 'var(--color-danger)', group: 'Modération' },
  recipe_review_purged:     { label: 'Avis supprimé définitivement',   color: '#7F1D1D', group: 'Modération' },
  sensitive_data_accessed:  { label: 'Données sensibles consultées',   color: '#7C5CAF', group: 'RGPD' },
  rgpd_request_completed:   { label: 'Demande RGPD traitée',           color: '#7C5CAF', group: 'RGPD' },
}

const GROUPS = ['Tous', ...new Set(Object.values(ACTION_LABELS).map(v => v.group))]

const STATUS_COLORS = {
  pending:  { bg: 'rgba(251,191,36,0.15)', color: 'var(--color-warning)' },
  approved: { bg: 'rgba(34,197,94,0.12)',  color: 'var(--color-success)' },
  rejected: { bg: 'rgba(239,68,68,0.12)',  color: 'var(--color-danger)' },
}

// Delegue au module partage (audit 2026-08-28) : les 17 occurrences codaient
// 'fr-FR' en dur, un admin anglophone lisait des dates francaises.
function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }

export default function JournalSection({ lang = 'fr', darkMode = false }) {
  const t = ADMIN_I18N[lang] ?? ADMIN_I18N.fr

  const [logs,        setLogs]        = useState([])
  const [logDetails,  setLogDetails]  = useState({})
  const [logCount,    setLogCount]    = useState(0)
  const [logPage,     setLogPage]     = useState(0)
  const [expandedId,  setExpandedId]  = useState(null)
  const [search,      setSearch]      = useState('')
  const [groupFilter, setGroupFilter] = useState('Tous')

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux pages laissait la plus ancienne écraser la plus récente.
  // Deux vagues d'`await` ⇒ un garde avant CHAQUE vague de setters.
  const { loading } = useReloader(async (estObsolete) => {
    const { data, count } = await adminGetLogs(logPage)
    if (estObsolete()) return
    setLogs(data ?? [])
    setLogCount(count ?? 0)
    if (data?.length) {
      const recipeIds = [...new Set(data.filter(l => l.target_type === 'recipe' && l.target_id).map(l => l.target_id))]
      const userIds   = [...new Set(data.filter(l => l.target_type === 'user'   && l.target_id).map(l => l.target_id))]
      const [{ data: recs }, { data: usrs }] = await Promise.all([
        recipeIds.length ? adminGetRecipesByIds(recipeIds) : Promise.resolve({ data: [] }),
        userIds.length   ? adminGetUsersByIds(userIds)     : Promise.resolve({ data: [] }),
      ])
      if (estObsolete()) return
      const details = {}
      ;(recs ?? []).forEach(r => { details[r.id] = { _type: 'recipe', ...r } })
      ;(usrs ?? []).forEach(u => { details[u.id] = { _type: 'user',   ...u } })
      setLogDetails(details)
    }
  }, [logPage])

  const filtered = useMemo(() => {
    let list = logs
    if (groupFilter !== 'Tous') {
      list = list.filter(l => (ACTION_LABELS[l.action]?.group ?? 'Autres') === groupFilter)
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(l => l.username?.toLowerCase().includes(s))
    }
    return list
  }, [logs, groupFilter, search])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <p style={{ fontSize:13, color:muted, margin:0 }}>{t.secJournalDesc}</p>

      {/* Filtres */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {GROUPS.map(g => (
            <FilterPill
              key={g}
              active={groupFilter === g}
              onClick={() => { setGroupFilter(g); setExpandedId(null) }}
              border={border}
              muted={muted}
            >
              {g}
            </FilterPill>
          ))}
        </div>
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <LuSearch size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:muted, pointerEvents:'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par admin…"
            style={{ width:'100%', padding:'5px 10px 5px 27px', borderRadius:8, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FBF8F3', color:fg, fontSize:12, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
        </div>
      </div>

      {loading
        ? <div style={{ padding:'24px 0', textAlign:'center', color:muted, fontSize:13 }}>Chargement…</div>
        : filtered.length === 0
        ? <EmptyState muted={muted}>Aucune entrée correspondante</EmptyState>
        : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filtered.map(log => {
                const detail  = logDetails[log.target_id]
                const isOpen  = expandedId === log.id
                const lbl     = ACTION_LABELS[log.action]
                return (
                  <div key={log.id}
                    style={{ borderRadius:8, background:rowBg, border:`1px solid ${isOpen ? 'rgba(224,120,32,0.45)' : border}`, overflow:'hidden', transition:'border-color 0.15s' }}>
                    <div
                      onClick={() => detail && setExpandedId(isOpen ? null : log.id)}
                      style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:12, cursor: detail ? 'pointer' : 'default' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:13, fontWeight:700, color: lbl?.color ?? fg }}>
                          {lbl?.label ?? log.action}
                        </span>
                        {log.username && <span style={{ fontSize:12, color:muted, marginLeft:6 }}>— {log.username}</span>}
                        {lbl?.group && (
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:`${lbl.color}18`, color:lbl.color, marginLeft:8, fontWeight:600 }}>
                            {lbl.group}
                          </span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        {detail && <span style={{ fontSize:11, color:muted, opacity:0.5 }}>👁</span>}
                        <span style={{ fontSize:12, color:muted }}>{fmtDate(log.created_at)}</span>
                      </div>
                    </div>
                    {isOpen && detail && (
                      <div style={{ padding:'8px 14px 10px', borderTop:`1px solid ${border}`, background: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.03)' }}>
                        {detail._type === 'recipe' && (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:18 }}>{detail.data?.emoji ?? '🍽️'}</span>
                            <span style={{ fontSize:13, fontWeight:600, color:fg }}>{detail.title}</span>
                            {detail.moderation_status && (
                              <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:5, background:STATUS_COLORS[detail.moderation_status]?.bg, color:STATUS_COLORS[detail.moderation_status]?.color, flexShrink:0 }}>
                                {detail.moderation_status}
                              </span>
                            )}
                          </div>
                        )}
                        {detail._type === 'user' && (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <AvatarImg avatarId={detail.avatar_id} size={22} />
                            <span style={{ fontSize:13, fontWeight:600, color:fg }}>{detail.username}</span>
                            {detail.role === 'admin' && <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:5, background:'rgba(247,168,94,0.2)', color:'var(--color-warm-600)' }}>admin</span>}
                            {detail.banned && <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:5, background:'rgba(239,68,68,0.15)', color:'var(--color-danger)' }}>banni</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {logCount > PER_PAGE && (
              <Pagination
                page={logPage}
                totalPages={Math.ceil(logCount / PER_PAGE)}
                onPageChange={setLogPage}
                itemsCount={logCount}
                itemsLabel="entrées"
                border={border}
                muted={muted}
                text={fg}
              />
            )}
          </>
        )
      }
    </div>
  )
}
