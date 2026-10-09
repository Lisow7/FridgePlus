import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuTrash2, LuRefreshCw, LuFlag, LuVolumeX, LuVolume2 } from 'react-icons/lu'
import {
  adminListPosts, adminListCommunityReports,
  adminSoftDeletePost, adminHardDeletePost,
  adminMuteUser, adminUnmuteUser,
} from '@features/admin/api/community-admin'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import SearchInput from '../shared/search-input'
import BulkActionBar from '../shared/bulk-action-bar'
import CaseDeSelection from '../shared/case-de-selection'
import { appliquerEnLot, messageDeLot } from '@features/admin/lib/appliquer-en-lot'
import { useSelection } from '@features/admin/hooks/use-selection'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import FilterPill from '@shared/ui/filter-pill'
import EmptyState from '@shared/ui/empty-state'
import { useReloader } from '@shared/hooks/use-reloader'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'

const STATUS_FILTERS = [
  { key: 'active',        label: 'Actifs' },
  { key: 'admin_deleted', label: 'Modérés' },
  { key: 'deleted',       label: 'Supprimés (auteur)' },
  { key: 'all',           label: 'Tous' },
]

const MUTE_DURATIONS = [
  { days: 1,    label: '1 jour' },
  { days: 7,    label: '7 jours' },
  { days: 30,   label: '30 jours' },
  { days: null, label: 'Permanent' },
]

function fmtMuteUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (d.getFullYear() >= 9999) return 'Permanent'
  const now = new Date()
  if (d <= now) return null
  return `Muté jusqu'au ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

export default function CommunitySection({ darkMode = false }) {
  const [posts,      setPosts]      = useState([])
  const [reports,    setReports]    = useState([])
  const [status,     setStatus]     = useState('active')
  const [search,     setSearch]     = useState('')
  const [feedback,   setFeedback]   = useState(null)

  // Modales
  const [actionPost,    setActionPost]    = useState(null)
  const [reasonInput,   setReasonInput]   = useState('')
  const [muteDays,      setMuteDays]      = useState(7)
  const [confirmHard,   setConfirmHard]   = useState(null)
  const [confirmBulkSoft, setConfirmBulkSoft] = useState(false)
  const sel = useSelection()
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogueAction = useDialogue({ onClose: () => setActionPost(null), actif: !!actionPost && !confirmHard })

  const fg      = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted   = darkMode ? '#A0A8B8' : '#7A6A52'
  const border  = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'
  const cardBg  = darkMode ? '#131E2C' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  // Une requête quand on cesse de taper, pas une par frappe (audit ADM-09).
  const rechercheStable = useDebouncedValue(search)
  const { loading, error, reload } = useReloader(async (estObsolete) => {
    const [p, r] = await Promise.all([
      adminListPosts({ status, search: rechercheStable, limit: 100 }),
      adminListCommunityReports({ limit: 100 }),
    ])
    if (estObsolete()) return
    setPosts(p)
    setReports(r)
  }, [status, rechercheStable])

  const reportsByPost = useMemo(() => reports.reduce((acc, r) => {
    if (r.target_type === 'community_post') {
      acc[r.target_id] = (acc[r.target_id] ?? 0) + 1
    }
    return acc
  }, {}), [reports])

  function showFeedback(text, type = 'success') {
    setFeedback({ text, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  async function handleSoft(post) {
    const result = await adminSoftDeletePost(post.id, reasonInput.trim() || 'admin_action', reportsByPost[post.id])
    if (result?.error) { showFeedback(result.error, 'error') }
    else { showFeedback('Post masqué.'); reload() }
    setActionPost(null)
    setReasonInput('')
  }

  async function handleBulkSoft() {
    const ids = sel.ids
    setConfirmBulkSoft(false)
    if (!ids.length) return
    // Les resultats etaient jetes : un echec passait pour un succes.
    const bilan = await appliquerEnLot(ids, id => adminSoftDeletePost(id, 'admin_action', reportsByPost[id]))
    showFeedback(
      messageDeLot(bilan, n => `post${n > 1 ? 's' : ''} masqué${n > 1 ? 's' : ''}`),
      bilan.toutReussi ? 'success' : 'error',
    )
    sel.clear()
    reload()
  }

  async function handleHard(post) {
    const result = await adminHardDeletePost(post.id, reasonInput.trim() || 'admin_action')
    if (result?.error) { showFeedback(result.error, 'error') }
    else { showFeedback('Post supprimé définitivement.'); reload() }
    setConfirmHard(null)
    setActionPost(null)
    setReasonInput('')
  }

  async function handleMute(post) {
    const result = await adminMuteUser(post.user_id, reasonInput.trim() || 'admin_action', muteDays)
    if (result?.error) { showFeedback(result.error, 'error') }
    else {
      const label = muteDays === null ? 'Utilisateur mis en sourdine, sans fin.' : `Utilisateur mis en sourdine ${muteDays} jour${muteDays > 1 ? 's' : ''}.`
      showFeedback(label)
      reload()
    }
    setActionPost(null)
    setReasonInput('')
  }

  async function handleUnmute(post) {
    const result = await adminUnmuteUser(post.user_id, 'admin_unmute')
    if (result?.error) { showFeedback(result.error, 'error') }
    else { showFeedback('Sourdine levée.'); reload() }
  }

  async function handleAction() {
    if (!actionPost) return
    const { post, action } = actionPost
    if (action === 'soft')   await handleSoft(post)
    else if (action === 'mute')   await handleMute(post)
    else if (action === 'unmute') await handleUnmute(post)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <FeedbackBanner feedback={feedback} />

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map(f => (
          <FilterPill
            key={f.key}
            active={status === f.key}
            onClick={() => setStatus(f.key)}
            border={border}
            muted={muted}
            className="border-[1.5px] px-3 py-1.5 font-bold"
          >
            {f.label}
          </FilterPill>
        ))}
        <div style={{ flex: 1 }} />
        <SearchInput value={search} onChange={setSearch} label="Rechercher un titre" darkMode={darkMode} width={190} />
        <Button
          variant="ghost"
          size="icon"
          onClick={reload}
          aria-label="Recharger"
          className="h-auto w-auto rounded-lg border-[1.5px] px-2.5 py-1.5 hover:bg-transparent"
          style={{ borderColor: border, background: cardBg, color: muted }}
        >
          <LuRefreshCw size={14} />
        </Button>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: muted, fontStyle: 'italic' }}>Chargement…</p>
      ) : error ? (
        <ChargementRate error={error} onRetry={reload} />
      ) : posts.length === 0 ? (
        <EmptyState muted={muted}>Aucun post pour ce filtre.</EmptyState>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {posts.map(post => {
            const reportCount    = reportsByPost[post.id] ?? 0
            const isDeletedAdmin = post.deleted_by_admin === true
            const isDeletedAuthor = !!post.deleted_at && !isDeletedAdmin
            const muteLabel      = fmtMuteUntil(post.profile?.community_muted_until)
            const isMuted        = !!muteLabel

            return (
              <li key={post.id} style={{ padding: '10px 12px', borderRadius: '10px', border: `1px solid ${reportCount > 0 ? '#D06060' : border}`, background: cardBg, display: 'flex', flexDirection: 'column', gap: '6px' }}>

                {/* Ligne principale */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  {status === 'active' && (
                    <CaseDeSelection cochee={sel.isSelected(post.id)} onBasculer={() => sel.toggle(post.id)} nom="Sélectionner ce post" style={{ alignSelf: 'flex-start' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Titre + badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                      {reportCount > 0 && (
                        <span title={`${reportCount} signalement${reportCount > 1 ? 's' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: '#D06060', background: 'rgba(208,96,96,0.10)', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
                          <LuFlag size={11} /> {reportCount}
                        </span>
                      )}
                      {isDeletedAdmin && <span style={{ fontSize: '10px', fontWeight: 700, color: '#D06060', background: 'rgba(208,96,96,0.12)', padding: '1px 6px', borderRadius: '4px' }}>Modéré</span>}
                      {isDeletedAuthor && <span style={{ fontSize: '10px', fontWeight: 700, color: muted, background: darkMode ? '#1A2535' : 'var(--color-border-warm)', padding: '1px 6px', borderRadius: '4px' }}>Supprimé</span>}
                    </div>
                    {/* Méta */}
                    <div style={{ fontSize: '11px', color: muted }}>
                      <strong style={{ color: isMuted ? 'var(--color-brand-500)' : undefined }}>{post.profile?.username ?? '— supprimé'}</strong>
                      {isMuted && (
                        <span title={muteLabel} style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: 'var(--color-brand-500)', background: 'rgba(224,120,32,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                          🔇 {muteLabel}
                        </span>
                      )}
                      {' · '}{post.category}
                      {' · '}{new Date(post.created_at).toLocaleDateString('fr-FR')}
                      {' · '}{post.likes_count} ♥ · {post.replies_count} 💬
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {!isDeletedAdmin && (
                      <Button
                        variant="ghost"
                        onClick={() => setActionPost({ post, action: 'soft' })}
                        title="Masquer (réversible)"
                        className="h-auto rounded-md border bg-transparent px-2 py-1 text-[11px] font-bold hover:bg-transparent"
                        style={{ gap: '4px', borderColor: border, color: '#D06060' }}
                      >
                        <LuTrash2 size={12} /> Masquer
                      </Button>
                    )}
                    <Button
                      onClick={() => setConfirmHard({ post })}
                      title="Supprimer définitivement"
                      className="h-auto rounded-md border px-2 py-1 text-[11px] font-bold"
                      style={{ gap: '4px', borderColor: '#D06060', background: 'rgba(208,96,96,0.08)', color: '#D06060' }}
                    >
                      <LuTrash2 size={12} /> Supprimer définitivement
                    </Button>
                    {post.user_id && (
                      isMuted ? (
                        <Button
                          variant="ghost"
                          onClick={() => handleUnmute(post)}
                          title="Lever la sourdine"
                          className="h-auto rounded-md border bg-transparent px-2 py-1 text-[11px] font-bold hover:bg-transparent"
                          style={{ gap: '4px', borderColor: border, color: 'var(--color-success)' }}
                        >
                          <LuVolume2 size={12} /> Lever la sourdine
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => setActionPost({ post, action: 'mute' })}
                          title="Mettre l'auteur en sourdine"
                          className="h-auto rounded-md border bg-transparent px-2 py-1 text-[11px] font-bold hover:bg-transparent"
                          style={{ gap: '4px', borderColor: border, color: muted }}
                        >
                          <LuVolumeX size={12} /> Sourdine
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Aperçu corps du post */}
                {post.body && (
                  <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: muted, whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', paddingLeft: '6px', borderLeft: `2px solid ${border}` }}>
                    {post.body}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {status === 'active' && (
        <BulkActionBar count={sel.count} lang="fr" darkMode={darkMode} onClear={sel.clear}
          actions={[{ label: 'Masquer la sélection', onClick: () => setConfirmBulkSoft(true), danger: true }]} />
      )}

      {/* Modale soft-delete / mute (raison + durée) */}
      {actionPost && !confirmHard && (
        <div onClick={() => setActionPost(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div {...dialogueAction.proprietes} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', background: darkMode ? '#0F1925' : '#FDFAF6', color: fg, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.40)' }}>
            <h4 id={dialogueAction.titreId} style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
              {actionPost.action === 'soft' && 'Masquer ce post'}
              {actionPost.action === 'mute' && 'Mettre l\'auteur en sourdine'}
              {actionPost.action === 'unmute' && 'Lever la sourdine'}
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: muted }}>
              <strong>« {actionPost.post.title} »</strong> par {actionPost.post.profile?.username ?? '—'}
            </p>

            {actionPost.action === 'mute' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: muted, textTransform: 'uppercase' }}>Durée</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {MUTE_DURATIONS.map(d => (
                    <Button
                      key={String(d.days)}
                      variant="ghost"
                      type="button"
                      aria-pressed={muteDays === d.days}
                      onClick={() => setMuteDays(d.days)}
                      className="h-auto rounded-md border-[1.5px] px-2.5 py-1 text-[11px] font-bold hover:bg-transparent"
                      style={{
                        borderColor: muteDays === d.days ? 'var(--color-brand-500)' : border,
                        background: muteDays === d.days ? 'rgba(224,120,32,0.10)' : 'transparent',
                        color: muteDays === d.days ? 'var(--color-brand-500)' : muted,
                      }}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: muted, textTransform: 'uppercase' }}>Raison (audit)</span>
              <textarea value={reasonInput} onChange={e => setReasonInput(e.target.value)}
                placeholder="ex: contenu inapproprié — spam — harcèlement…"
                rows={3} maxLength={500}
                style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${border}`, background: cardBg, color: fg, fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <Button
                variant="ghost"
                onClick={() => { setActionPost(null); setReasonInput('') }}
                className="h-auto rounded-lg border bg-transparent px-3.5 py-1.5 text-xs font-semibold hover:bg-transparent"
                style={{ borderColor: border, color: muted }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleAction}
                className="h-auto rounded-lg bg-[#D06060] px-3.5 py-1.5 text-xs font-bold text-white"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale hard-delete via ConfirmDeleteModal */}
      {confirmHard && createPortal(
        <ConfirmDeleteModal
          title="Supprimer définitivement ce post ?"
          body={`« ${confirmHard.post.title} » sera supprimé de façon irréversible. Cette action est auditée.`}
          confirmLabel="Supprimer définitivement"
          cancelLabel="Annuler"
          onConfirm={() => handleHard(confirmHard.post)}
          onCancel={() => setConfirmHard(null)}
          darkMode={darkMode}
        />, document.body
      )}
      {confirmBulkSoft && createPortal(
        <ConfirmDeleteModal
          title={`Masquer ${sel.count} post${sel.count > 1 ? 's' : ''} ?`}
          body="Les posts sélectionnés seront masqués (action réversible, auditée)."
          confirmLabel="Masquer" cancelLabel="Annuler"
          onConfirm={handleBulkSoft} onCancel={() => setConfirmBulkSoft(false)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
