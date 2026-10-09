import { useState, useMemo, useId } from 'react'
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
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import ChargementRate from '../shared/chargement-rate'
import Button from '@shared/ui/button'
import { LIBELLES_DU_JOURNAL } from '@features/admin/lib/libelles-du-journal'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'

const PER_PAGE = 50

// Les noms viennent du module unique, partagé avec le tableau de bord (audit
// du 2026-10-04, ADM-06) ; le garde-fou `journal-tout-a-un-nom` exige un nom
// pour toute action que le code ou la base écrit.
const ACTION_LABELS = LIBELLES_DU_JOURNAL

// « Autres » : une action sans nom (écrite par une version à venir, ou oubliée)
// se range là — le filtre la classait déjà ainsi, mais aucune pastille ne
// permettait de la choisir.
const GROUPS = ['Tous', ...new Set(Object.values(ACTION_LABELS).map(v => v.group)), 'Autres']

const STATUS_COLORS = {
  pending:  { bg: 'rgba(251,191,36,0.15)', color: 'var(--color-warning)' },
  approved: { bg: 'rgba(34,197,94,0.12)',  color: 'var(--color-success)' },
  rejected: { bg: 'rgba(239,68,68,0.12)',  color: 'var(--color-danger)' },
}

// Delegue au module partage (audit 2026-08-28) : les 17 occurrences codaient
// 'fr-FR' en dur, un admin anglophone lisait des dates francaises.
function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }

// Ce qu'une consultation de données sensibles a montré (`metadata.champs`,
// écrit par `admin_reveler_compte`, audit ADM-05).
const CHAMPS_VUS = { email: 'e-mail', last_sign_in_at: 'dernière connexion', allergen_prefs: 'allergènes' }

// L'en-tête d'une ligne : un vrai bouton quand il y a un détail à déplier, qui
// dit s'il est déplié (audit du 2026-10-04, ADM-19 d : c'était une `div`
// cliquable, hors de l'ordre de tabulation) ; un simple bloc sinon.
function EnTeteDeLigne({ depliable, deplie, onBasculer, children }) {
  const style = { padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }
  if (!depliable) return <div style={style}>{children}</div>
  return (
    <Button variant="ghost" aria-expanded={deplie} onClick={onBasculer}
      className="h-auto w-full justify-start rounded-none text-left font-normal hover:bg-transparent" style={style}>
      {children}
    </Button>
  )
}

export default function JournalSection({ lang = 'fr', darkMode = false }) {
  const t = ADMIN_I18N[lang] ?? ADMIN_I18N.fr

  const [logs,        setLogs]        = useState([])
  const [logDetails,  setLogDetails]  = useState({})
  const [logCount,    setLogCount]    = useState(0)
  const [logPage,     setLogPage]     = useState(0)
  const [expandedId,  setExpandedId]  = useState(null)
  const [search,      setSearch]      = useState('')
  const rechercheId = useId()
  const [groupFilter, setGroupFilter] = useState('Tous')
  const auteurStable = useDebouncedValue(search) // une requête quand on cesse de taper

  // Les filtres partent à la base (audit ADM-10) : ici, ils ne portaient que
  // sur la page affichée, et la pagination comptait tout le journal.
  const filtres = useMemo(() => {
    if (groupFilter === 'Tous') return {}
    if (groupFilter === 'Autres') return { saufActions: Object.keys(ACTION_LABELS) }
    return { actions: Object.keys(ACTION_LABELS).filter((cle) => ACTION_LABELS[cle].group === groupFilter) }
  }, [groupFilter])

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux pages laissait la plus ancienne écraser la plus récente.
  // Deux vagues d'`await` ⇒ un garde avant CHAQUE vague de setters.
  const { loading, error, reload } = useReloader(async (estObsolete) => {
    const { data, count } = leverSiErreur(await adminGetLogs(logPage, { ...filtres, auteur: auteurStable }))
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
  }, [logPage, filtres, auteurStable])

  const filtered = logs

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
              onClick={() => { setGroupFilter(g); setExpandedId(null); setLogPage(0) }}
              border={border}
              muted={muted}
            >
              {g}
            </FilterPill>
          ))}
        </div>
        {/* Libellé visible à gauche, à la hauteur des pastilles (décision du 2026-10-06). */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'4px 6px', flex:1, minWidth:160 }}>
          <label htmlFor={rechercheId} style={{ fontSize:12, fontWeight:700, color:'var(--color-muted)', whiteSpace:'nowrap' }}>Filtrer par admin</label>
          <div style={{ position:'relative', flex:1 }}>
            <LuSearch size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:muted, pointerEvents:'none' }} />
            <input id={rechercheId} value={search} onChange={e => { setSearch(e.target.value); setLogPage(0) }}
              style={{ width:'100%', padding:'5px 10px 5px 27px', borderRadius:8, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FBF8F3', color:fg, fontSize:12, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
          </div>
        </div>
      </div>

      {loading
        ? <div style={{ padding:'24px 0', textAlign:'center', color:muted, fontSize:13 }}>Chargement…</div>
        : error
        ? <ChargementRate error={error} onRetry={reload} lang={lang} />
        : filtered.length === 0
        ? <EmptyState muted={muted}>Aucune entrée correspondante</EmptyState>
        : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {filtered.map(log => {
                const detail  = logDetails[log.target_id]
                const isOpen  = expandedId === log.id
                const lbl     = ACTION_LABELS[log.action]
                // Le motif d'une consultation de données sensibles, et ce qui a
                // été vu (audit ADM-05) : une saisie libre de l'admin, affichée
                // comme du texte. Les anciennes lignes n'en ont pas.
                const motif   = typeof log.metadata?.reason === 'string' ? log.metadata.reason : null
                const champs  = Array.isArray(log.metadata?.champs) ? log.metadata.champs : []
                return (
                  <div key={log.id}
                    style={{ borderRadius:8, background:rowBg, border:`1px solid ${isOpen ? 'rgba(224,120,32,0.45)' : border}`, overflow:'hidden', transition:'border-color 0.15s' }}>
                    <EnTeteDeLigne depliable={!!detail || !!motif} deplie={isOpen} onBasculer={() => setExpandedId(isOpen ? null : log.id)}>
                      <span style={{ display:'block', flex:1, minWidth:0 }}>
                        <span style={{ fontSize:13, fontWeight:700, color: lbl ? texteLisible(lbl.color) : fg }}>
                          {lbl?.label ?? log.action}
                        </span>
                        {log.username && <span style={{ fontSize:12, color:muted, marginLeft:6 }}>— {log.username}</span>}
                        {lbl?.group && (
                          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background: fondTeinte(lbl.color, 10), color: texteLisible(lbl.color), marginLeft:8, fontWeight:600 }}>
                            {lbl.group}
                          </span>
                        )}
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        {(detail || motif) && <span aria-hidden="true" style={{ fontSize:11, color:muted, opacity:0.5 }}>👁</span>}
                        <span style={{ fontSize:12, color:muted }}>{fmtDate(log.created_at)}</span>
                      </span>
                    </EnTeteDeLigne>
                    {isOpen && (detail || motif) && (
                      <div style={{ padding:'8px 14px 10px', borderTop:`1px solid ${border}`, background: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.03)' }}>
                        {detail?._type === 'recipe' && (
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
                        {detail?._type === 'user' && (
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <AvatarImg avatarId={detail.avatar_id} size={22} />
                            <span style={{ fontSize:13, fontWeight:600, color:fg }}>{detail.username}</span>
                            {detail.role === 'admin' && <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:5, background:'rgba(247,168,94,0.2)', color:'var(--color-warm-600)' }}>admin</span>}
                            {detail.banned && <span style={{ fontSize:11, fontWeight:600, padding:'2px 6px', borderRadius:5, background:'rgba(239,68,68,0.15)', color:'var(--color-danger)' }}>banni</span>}
                          </div>
                        )}
                        {motif && (
                          <p style={{ margin:'6px 0 0', fontSize:12, color:muted }}>
                            Motif : <span style={{ color:fg }}>{motif}</span>
                          </p>
                        )}
                        {champs.length > 0 && (
                          <p style={{ margin:'4px 0 0', fontSize:12, color:muted }}>
                            Données vues : {champs.map((c) => CHAMPS_VUS[c] ?? c).join(', ')}
                          </p>
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
