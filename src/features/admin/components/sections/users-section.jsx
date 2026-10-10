import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuBan, LuChevronDown, LuCopy, LuCheck, LuShieldPlus, LuShieldMinus } from 'react-icons/lu'
import { useAllergenTypes } from '@shared/contexts/data-provider'
import { adminGetUsers, adminGetUserCounts, adminRevelerCompte, adminGetUserProfile, adminGrantSpecialAccess, adminRevokeSpecialAccess, adminGetSpecialAccessNote } from '@features/admin/api/admin'
import { adminBannir, adminDebannir, notifierLeBannissement } from '@features/admin/api/bannissement'
import FenetreDeBannissement from '../modals/fenetre-de-bannissement'
import AvatarImg from '@shared/ui/avatar-img'
import SensitiveDataToggle from '../shared/sensitive-data-toggle'
import { ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import SearchInput from '../shared/search-input'
import Button from '@shared/ui/button'
import FilterPill from '@shared/ui/filter-pill'
import EmptyState from '@shared/ui/empty-state'
import Pagination from '@shared/ui/pagination'
import SpecialAccessModal from '@features/admin/components/modals/special-access-modal'
import SpecialRoleBadge from '@shared/ui/special-role-badge'
import { formatDate } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'
import { leverSiErreur } from '@shared/lib/supabase/lever-si-erreur'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

const PER_PAGE = 30

function fmtDate(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

const STATUS_COLORS = {
  pending:  { bg:'rgba(251,191,36,0.15)', color:'var(--color-warning)' },
  approved: { bg:'rgba(34,197,94,0.12)',  color:'var(--color-success)' },
  rejected: { bg:'rgba(239,68,68,0.12)',  color:'var(--color-danger)' },
}

const FILTERS = [
  { key: 'all',    label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'banned', label: 'Bannis',  color: 'var(--color-danger)' },
  { key: 'admins', label: 'Admins',  color: '#7C5CAF' },
]

export default function UsersSection({ lang = 'fr', darkMode = false }) {
  const allergenTypes = useAllergenTypes()

  const border    = darkMode ? '#2A3A50' : '#D9CCBA'
  const textColor = darkMode ? '#C8D8E8' : '#1A0F00'
  const muted     = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg     = darkMode ? '#141F2E' : '#F2E8D8'

  const [users,          setUsers]          = useState([])
  const [count,          setCount]          = useState(0)     // total du filtre+recherche courant (pagination)
  const [counts,         setCounts]         = useState({ all: 0, active: 0, banned: 0, admins: 0 }) // badges
  const [expandedUserId, setExpandedUserId] = useState(null)
  const [userDetails,    setUserDetails]    = useState({})
  const [search,         setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')  // envoyé au serveur (anti-rafale de requêtes)
  const [filter,         setFilter]         = useState('all')
  const [sort,           setSort]           = useState('newest')
  const [page,           setPage]           = useState(0)
  const [confirmBan,        setConfirmBan]        = useState(null) // débannir : une confirmation
  const [fenetreBan,        setFenetreBan]        = useState(null) // bannir : motif et durée (lot 3c-3b)
  const [specialAccessModal, setSpecialAccessModal] = useState(null)
  // { userId, username, currentRole: 'tester'|'support'|'influencer'|'partner'|null }
  const [copiedId,           setCopiedId]           = useState(null)
  const [feedback,           showFeedback]          = useFeedback()

  // Debounce de la recherche : on n'interroge le serveur que 300 ms après la
  // dernière frappe, et on revient à la page 0.
  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(id)
  }, [search])

  // Page de résultats : pagination/recherche/filtre/tri côté serveur (audit §3).
  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  const { loading, error: erreurChargement, reload: loadUsers } = useReloader(async (estObsolete) => {
    const { data, count: total } = leverSiErreur(await adminGetUsers({ page, search: debouncedSearch, filter, sort }))
    if (estObsolete()) return
    setUsers(data ?? []); setCount(total ?? 0)
  }, [page, debouncedSearch, filter, sort])

  // Compteurs de badge (indépendants de la recherche).
  const loadCounts = useCallback(async () => { setCounts(await adminGetUserCounts()) }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCounts() }, [loadCounts])

  // E-mail, dernière connexion, allergènes : plus rien n'est chargé ici. Ils
  // étaient lus pour TOUS les comptes à l'ouverture de l'onglet, sans trace ;
  // ils se demandent maintenant un compte à la fois, avec un motif, derrière
  // le rideau « Données sensibles » de la fiche (audit du 2026-10-04, ADM-05).

  const totalPages = Math.ceil(count / PER_PAGE)

  // Bannir PAR LA BASE (audit du 2026-10-04, lot 3c-3b) : motif montré à la
  // personne, durée, session coupée, reconnexion refusée jusqu'à l'échéance.
  // Un refus reste dans la fenêtre ; le succès la ferme et le dit.
  async function handleBannir({ motif, jours }) {
    const { userId, username } = fenetreBan
    const { fin, error } = await adminBannir(userId, motif, jours)
    if (error) return { error }
    setFenetreBan(null)
    const { envoye } = await notifierLeBannissement(userId)
    const quand = fin
      ? `${username} est banni jusqu’au ${new Date(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : `${username} est banni, sans date de fin.`
    showFeedback(true, `${quand} ${envoye ? 'Un e-mail lui a dit le motif et la date.' : 'L’e-mail n’a pas pu partir : préviens la personne autrement.'}`)
    // Le statut déplace l'utilisateur entre buckets (actif/banni) et change les
    // badges → on resynchronise page + compteurs depuis le serveur.
    loadUsers(); loadCounts()
    return { error: null }
  }

  // Une seule écriture : la confirmation reste ouverte et éteinte pendant
  // l'écriture ; un second clic ne part pas (ADM-29 — deux `user_unbanned`).
  const debanRef = useRef(false)
  const [debanEnCours, setDebanEnCours] = useState(false)
  async function handleDebannir(userId) {
    if (debanRef.current) return
    debanRef.current = true
    setDebanEnCours(true)
    const { error } = await adminDebannir(userId)
    debanRef.current = false
    setDebanEnCours(false)
    setConfirmBan(null)
    if (error) showFeedback(false, error.message)
    loadUsers(); loadCounts()
  }

  // Les deux rendent `{ error }` : la fenêtre dit un refus et reste ouverte ;
  // un succès la ferme et le dit (audit du 2026-10-04, ADM-13).
  async function handleGrantSpecialAccess(role, note) {
    const { userId, username, currentRole } = specialAccessModal
    const { error } = await adminGrantSpecialAccess(userId, role, note)
    if (error) return { error }
    setUsers(u => u.map(x =>
      x.id === userId ? { ...x, subscription_status: 'comped', special_role: role } : x
    ))
    setSpecialAccessModal(null)
    showFeedback(true, currentRole ? `Accès spécial de ${username} modifié.` : `Accès spécial accordé à ${username}.`)
    return { error: null }
  }

  async function handleRevokeSpecialAccess() {
    const { userId, username } = specialAccessModal
    const { error } = await adminRevokeSpecialAccess(userId)
    if (error) return { error }
    setUsers(u => u.map(x =>
      x.id === userId ? { ...x, subscription_status: 'free', special_role: null } : x
    ))
    setSpecialAccessModal(null)
    showFeedback(true, `Accès spécial de ${username} retiré.`)
    return { error: null }
  }

  async function handleExpandUser(userId) {
    if (expandedUserId === userId) { setExpandedUserId(null); return }
    setExpandedUserId(userId)
    if (!userDetails[userId]) {
      setUserDetails(prev => ({ ...prev, [userId]: { loading: true } }))
      const profile = await adminGetUserProfile(userId)
      setUserDetails(prev => ({ ...prev, [userId]: { ...profile, loading: false } }))
    }
  }

  function handleCopyId(id) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <FeedbackBanner feedback={feedback} />
      {confirmBan && createPortal(
        <ConfirmActionModal
          darkMode={darkMode}
          title="Débannir cet utilisateur ?"
          body={`${confirmBan.username} pourra à nouveau se connecter, publier et écrire au support.`}
          confirmLabel="Débannir"
          cancelLabel="Annuler"
          busy={debanEnCours}
          onConfirm={() => handleDebannir(confirmBan.userId)}
          onCancel={() => { if (!debanEnCours) setConfirmBan(null) }}
        />,
        document.body
      )}
      {fenetreBan && (
        <FenetreDeBannissement username={fenetreBan.username} darkMode={darkMode} onBannir={handleBannir} onClose={() => setFenetreBan(null)} />
      )}

      {specialAccessModal && (
        <SpecialAccessModal
          darkMode={darkMode}
          username={specialAccessModal.username}
          currentRole={specialAccessModal.currentRole}
          onConfirmGrant={handleGrantSpecialAccess}
          onConfirmRevoke={handleRevokeSpecialAccess}
          onCancel={() => setSpecialAccessModal(null)}
          lireLaNote={() => adminGetSpecialAccessNote(specialAccessModal.userId)}
        />
      )}

      {/* Barre de contrôle */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        {/* Filtres statut */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <FilterPill
              key={f.key}
              active={filter === f.key}
              color={f.color ?? 'var(--color-brand-500)'}
              onClick={() => { setFilter(f.key); setPage(0) }}
              border={border}
              muted={muted}
            >
              {/* Le compteur se distingue par sa graisse, plus par une opacité qui le
                  faisait tomber à 2-3,6:1 (audit A11Y-03, 2026-10-08). */}
              {f.label} <span style={{ fontWeight:400 }}>({counts[f.key]})</span>
            </FilterPill>
          ))}
        </div>

        {/* Tri */}
        <select aria-label="Trier les comptes" value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}
          style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FBF8F3', color:textColor, fontSize:12, cursor:'pointer', outline:'none', fontFamily:'inherit' }}>
          <option value="newest">Récents</option>
          <option value="oldest">Anciens</option>
          <option value="az">A → Z</option>
        </select>

        {/* Recherche */}
        <SearchInput value={search} onChange={setSearch} label="Rechercher un pseudo" darkMode={darkMode} />
      </div>

      {/* Liste */}
      {loading
        ? <div style={{ textAlign:'center', padding:'40px', color:muted, fontSize:13 }}>Chargement…</div>
        : erreurChargement
        ? <ChargementRate error={erreurChargement} onRetry={loadUsers} lang={lang} />
        : users.length === 0
        ? <EmptyState muted={muted}>Aucun utilisateur.</EmptyState>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {users.map(u => {
              const isExpanded = expandedUserId === u.id
              const det  = userDetails[u.id]
              return (
                <div key={u.id} style={{ borderRadius:12, background: u.banned ? 'rgba(239,68,68,0.06)' : rowBg, border:`1px solid ${u.banned ? 'rgba(239,68,68,0.25)' : border}`, overflow:'hidden' }}>
                  {/* Trop étroit, les actions passent sous le pseudo : il tenait dans
                      17 px à 360 px (mesuré le 2026-10-08). */}
                  <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <AvatarImg avatarId={u.avatar_id} size={34} />
                    <div style={{ flex:'1 1 160px', minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:15, fontWeight:700, color:textColor }}>{u.username}</span>
                        {u.role === 'admin' && <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(124,92,175,0.18)', color:'#7C5CAF' }}>Admin</span>}
                        {u.special_role && <SpecialRoleBadge role={u.special_role} lang="fr" />}
                        {u.banned && <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'var(--color-danger)' }}>Banni</span>}
                      </div>
                      <div style={{ fontSize:11, color:muted, marginTop:3 }}>
                        Inscrit {fmtDate(u.created_at)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExpandUser(u.id)}
                      aria-expanded={isExpanded}
                      aria-label={`Détails de ${u.username}`}
                      className="h-7 w-7 rounded-md bg-transparent hover:bg-transparent"
                      style={{ color: muted }}
                    >
                      <LuChevronDown size={15} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
                    </Button>
                    {u.role !== 'admin' && (
                      <Button
                        onClick={() => setSpecialAccessModal({ userId: u.id, username: u.username, currentRole: u.special_role ?? null })}
                        title={u.special_role ? 'Gérer l\'accès spécial' : 'Accorder un accès spécial'}
                        className="h-auto flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                        style={{
                          gap: 4,
                          background: u.special_role ? 'rgba(212,106,16,0.12)' : 'rgba(212,106,16,0.06)',
                          color: texteLisible('#D46A10'),
                        }}
                      >
                        {u.special_role ? <LuShieldMinus size={13} /> : <LuShieldPlus size={13} />}
                        {u.special_role ? 'Accès spécial' : 'Accorder'}
                      </Button>
                    )}
                    {u.role !== 'admin' && (
                      <Button
                        onClick={() => (u.banned ? setConfirmBan : setFenetreBan)({ userId: u.id, username: u.username })}
                        className="h-auto flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                        style={{
                          gap: 4,
                          background: u.banned ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                          color: texteLisible(u.banned ? 'var(--color-success)' : 'var(--color-danger)'),
                        }}
                      >
                        <LuBan size={13} />{u.banned ? 'Débannir' : 'Bannir'}
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ padding:'12px 16px 14px', borderTop:`1px solid ${border}`, background: darkMode ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.03)', display:'flex', flexDirection:'column', gap:10 }}>
                      {det?.loading
                        ? <div style={{ textAlign:'center', padding:16, color:muted, fontSize:13 }}>…</div>
                        : det ? (<>
                          {/* ID copiable — utile pour les notifications ciblées */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                            <span style={{ fontWeight:600, color:muted, textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0 }}>ID</span>
                            <code style={{ color:textColor, fontFamily:'monospace', fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.id}</code>
                            <Button
                              variant="ghost"
                              onClick={() => handleCopyId(u.id)}
                              className="h-auto flex-shrink-0 rounded-md border bg-transparent px-2 py-0.5 text-[11px] hover:bg-transparent"
                              style={{
                                gap: 3,
                                borderColor: border,
                                color: copiedId === u.id ? 'var(--color-success)' : muted,
                              }}
                            >
                              {copiedId === u.id ? <><LuCheck size={11} /> Copié</> : <><LuCopy size={11} /> Copier</>}
                            </Button>
                          </div>

                          {/* Données sensibles : e-mail, dernière connexion, allergènes.
                              Rien n'est chargé avant : la base les rend, un compte à
                              la fois, après avoir écrit la trace avec le motif
                              (audit du 2026-10-04, ADM-05). */}
                          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, padding:'6px 10px', borderRadius:8, background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border:`1px solid ${border}` }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                              <span aria-hidden="true">🔒</span>
                              <span style={{ fontWeight:600, color:muted, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em' }}>Données sensibles</span>
                              <span style={{ fontSize:11, color:muted }}>e-mail, dernière connexion, allergènes</span>
                            </div>
                            <SensitiveDataToggle charger={(motif) => adminRevelerCompte(u.id, motif)} lang={lang} darkMode={darkMode}>
                              {(donnee) => (
                                <span style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                  <span style={{ color:textColor, fontFamily:'monospace', fontSize:13 }}>{donnee.email}</span>
                                  <span style={{ fontSize:12, color:muted }}>Dernière connexion : {donnee.derniereConnexion ? fmtDate(donnee.derniereConnexion) : 'jamais'}</span>
                                  {donnee.allergenes.length === 0
                                    ? <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>Aucun allergène déclaré</span>
                                    : <span style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                        {donnee.allergenes.map(key => {
                                          const a = allergenTypes[key]
                                          return (
                                            <span key={key} style={{ fontSize:12, padding:'2px 8px', borderRadius:4, background:'rgba(239,68,68,0.1)', color:'var(--color-danger)', border:'1px solid rgba(239,68,68,0.2)' }}>
                                              {a?.icon} {a?.labels?.[lang] ?? a?.labels?.fr ?? key}
                                            </span>
                                          )
                                        })}
                                      </span>
                                  }
                                </span>
                              )}
                            </SensitiveDataToggle>
                          </div>

                          {/* Favoris */}
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                              Favoris <span style={{ fontWeight:400, textTransform:'none', fontSize:12 }}>({det.favorites?.length ?? 0})</span>
                            </div>
                            {!det.favorites?.length
                              ? <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>—</span>
                              : <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxHeight:72, overflow:'auto' }}>
                                  {det.favorites.map(id => (
                                    <span key={id} style={{ fontSize:11, padding:'2px 7px', borderRadius:4, background:'rgba(224,120,32,0.1)', color:'var(--color-brand-500)', border:'1px solid rgba(224,120,32,0.2)', whiteSpace:'nowrap' }}>
                                      ❤️ {id}
                                    </span>
                                  ))}
                                </div>
                            }
                          </div>

                          {/* Recettes créées */}
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>
                              Recettes créées <span style={{ fontWeight:400, textTransform:'none', fontSize:12 }}>({det.recipes?.length ?? 0})</span>
                            </div>
                            {!det.recipes?.length
                              ? <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>Aucune recette.</span>
                              : <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                  {det.recipes.map(r => {
                                    const sc = STATUS_COLORS[r.moderation_status] ?? STATUS_COLORS.pending
                                    return (
                                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:textColor }}>
                                        <span style={{ fontSize:16 }}>{r.data?.emoji ?? '🍽️'}</span>
                                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
                                        <span style={{ fontSize:11, padding:'1px 6px', borderRadius:5, background:sc.bg, color:sc.color, flexShrink:0 }}>{r.moderation_status}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                            }
                          </div>
                        </>) : null
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        itemsCount={count}
        itemsLabel="utilisateurs"
        border={border}
        muted={muted}
        text={textColor}
      />
    </div>
  )
}
