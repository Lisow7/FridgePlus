import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { LuStar, LuTrash2, LuRefreshCw, LuFlag, LuEyeOff } from 'react-icons/lu'
import {
  adminListReviews, adminListReviewReports,
  adminSoftDeleteReview, adminHardDeleteReview,
} from '@features/admin/api/recipe-reviews-admin'
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
import { texteLisible } from '@shared/lib/couleurs/texte-lisible'

const STATUS_FILTERS = [
  { key: 'active',        label: 'Actifs' },
  { key: 'admin_deleted', label: 'Masqués' },
  { key: 'deleted',       label: 'Supprimés (auteur)' },
  { key: 'all',           label: 'Tous' },
]

function StarFilter({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <Button
        variant="ghost"
        aria-pressed={value === 0}
        onClick={() => onChange(0)}
        className="h-auto rounded-lg border px-2 py-1 text-[11px] font-bold hover:bg-transparent"
        style={{
          borderColor: value === 0 ? 'var(--color-brand-500)' : 'var(--color-border-warm)',
          background: value === 0 ? 'rgba(224,120,32,0.1)' : 'transparent',
          color: value === 0 ? texteLisible('var(--color-brand-500)') : '#7A6A52',
        }}
      >
        Toutes
      </Button>
      {[1, 2, 3, 4, 5].map(n => (
        <Button
          key={n}
          variant="ghost"
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? 0 : n)}
          className="h-auto rounded-lg border px-2 py-1 text-[11px] font-bold hover:bg-transparent"
          style={{
            gap: 2,
            borderColor: value === n ? 'var(--color-brand-500)' : 'var(--color-border-warm)',
            background: value === n ? 'rgba(224,120,32,0.1)' : 'transparent',
            color: value === n ? texteLisible('var(--color-brand-500)') : '#7A6A52',
          }}
        >
          {n} <LuStar size={10} fill={value === n ? 'var(--color-brand-500)' : 'none'} stroke="currentColor" />
        </Button>
      ))}
    </div>
  )
}

export default function RecipeReviewsAdminSection({ darkMode = false }) {
  const [reviews,      setReviews]      = useState([])
  const [reports,      setReports]      = useState([])
  const [status,       setStatus]       = useState('active')
  const [search,       setSearch]       = useState('')
  const [ratingFilter, setRatingFilter] = useState(0)
  const [feedback,     setFeedback]     = useState(null)

  // Modale raison
  const [actionReview, setActionReview] = useState(null) // { review, action: 'soft'|'hard' }
  const [reasonInput,  setReasonInput]  = useState('')
  const [confirmHard,  setConfirmHard]  = useState(null)
  const [confirmBulkSoft, setConfirmBulkSoft] = useState(false)
  const sel = useSelection()
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogueAction = useDialogue({ onClose: () => setActionReview(null), actif: !!actionReview && !confirmHard })

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
    const [r, t] = await Promise.all([
      adminListReviews({ status, search: rechercheStable, limit: 100 }),
      adminListReviewReports({ limit: 100 }),
    ])
    if (estObsolete()) return
    setReviews(r); setReports(t)
  }, [status, rechercheStable])

  const reportsByReview = useMemo(() => reports.reduce((acc, r) => {
    acc[r.target_id] = (acc[r.target_id] ?? 0) + 1
    return acc
  }, {}), [reports])

  const filteredReviews = useMemo(() => {
    if (ratingFilter === 0) return reviews
    return reviews.filter(r => r.rating === ratingFilter)
  }, [reviews, ratingFilter])

  function showFeedback(text, type = 'success') {
    setFeedback({ text, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  async function handleSoft(review) {
    const result = await adminSoftDeleteReview(review.id, reasonInput.trim() || 'admin_action', reportsByReview[review.id])
    if (result?.error) showFeedback(result.error, 'error')
    else { showFeedback('Avis masqué.'); reload() }
    setActionReview(null)
    setReasonInput('')
  }

  async function handleHard(review) {
    const result = await adminHardDeleteReview(review.id, reasonInput.trim() || 'admin_action')
    if (result?.error) showFeedback(result.error, 'error')
    else { showFeedback('Avis supprimé définitivement.'); reload() }
    setConfirmHard(null)
    setActionReview(null)
    setReasonInput('')
  }

  async function handleBulkSoft() {
    const ids = sel.ids
    setConfirmBulkSoft(false)
    if (!ids.length) return
    const bilan = await appliquerEnLot(ids, id => adminSoftDeleteReview(id, 'admin_action', reportsByReview[id]))
    showFeedback(
      messageDeLot(bilan, n => `avis masqué${n > 1 ? 's' : ''}`),
      bilan.toutReussi ? 'success' : 'error',
    )
    sel.clear()
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <FeedbackBanner feedback={feedback} />

      {reports.length > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(208,96,96,0.08)', color: texteLisible('#D06060'), fontSize: 12, fontWeight: 600 }}>
          🚩 {reports.length} signalement{reports.length > 1 ? 's' : ''} ouvert{reports.length > 1 ? 's' : ''} sur des avis
        </div>
      )}

      {/* Filtres statut */}
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
        <SearchInput value={search} onChange={setSearch} label="Rechercher un commentaire" darkMode={darkMode} width={200} />
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

      {/* Filtre par note */}
      <StarFilter value={ratingFilter} onChange={setRatingFilter} />

      {/* Liste */}
      {loading ? (
        <p style={{ color: muted, fontStyle: 'italic' }}>Chargement…</p>
      ) : error ? (
        <ChargementRate error={error} onRetry={reload} />
      ) : filteredReviews.length === 0 ? (
        <EmptyState muted={muted}>Aucun avis pour ce filtre.</EmptyState>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredReviews.map(r => {
            const reportCount    = reportsByReview[r.id] ?? 0
            const isDeletedAdmin = r.deleted_by_admin === true
            const isDeletedAuthor = !!r.deleted_at && !isDeletedAdmin
            return (
              <li key={r.id} style={{ padding: '10px 12px', borderRadius: '10px', border: `1px solid ${reportCount > 0 ? '#D06060' : border}`, background: cardBg, display: 'flex', flexDirection: 'column', gap: '6px' }}>

                {/* Ligne méta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {status === 'active' && (
                    <CaseDeSelection cochee={sel.isSelected(r.id)} onBasculer={() => sel.toggle(r.id)} nom="Sélectionner cet avis" />
                  )}
                  <span style={{ display: 'inline-flex', gap: '1px', color: 'var(--color-brand-500)' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <LuStar key={n} size={13} fill={n <= r.rating ? 'currentColor' : 'none'} strokeWidth={2.2} />
                    ))}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: fg }}>{r.rating}/5</span>
                  <span style={{ fontSize: '12px', color: muted }}>·</span>
                  <span style={{ fontSize: '12px', color: muted, fontWeight: 600 }}>{r.profile?.username ?? '— supprimé'}</span>
                  <span style={{ fontSize: '12px', color: muted }}>·</span>
                  <span style={{ fontSize: '11px', color: muted, fontStyle: 'italic' }}>{r.recipe_source} / {r.recipe_id}</span>
                  <span style={{ fontSize: '12px', color: muted }}>·</span>
                  <span style={{ fontSize: '11px', color: muted }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  {reportCount > 0 && (
                    <span title={`${reportCount} signalement${reportCount > 1 ? 's' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 700, color: '#D06060', background: 'rgba(208,96,96,0.10)', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
                      <LuFlag size={11} /> {reportCount}
                    </span>
                  )}
                  {isDeletedAdmin && <span style={{ fontSize: '10px', fontWeight: 700, color: '#D06060', background: 'rgba(208,96,96,0.12)', padding: '1px 6px', borderRadius: '4px' }}>Masqué</span>}
                  {isDeletedAuthor && <span style={{ fontSize: '10px', fontWeight: 700, color: muted, background: darkMode ? '#1A2535' : 'var(--color-border-warm)', padding: '1px 6px', borderRadius: '4px' }}>Supprimé</span>}

                  <div style={{ flex: 1 }} />

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!isDeletedAdmin && (
                      <Button
                        variant="ghost"
                        onClick={() => setActionReview({ review: r, action: 'soft' })}
                        title="Masquer cet avis"
                        className="h-auto rounded-md border bg-transparent px-2 py-1 text-[11px] font-bold hover:bg-transparent"
                        style={{ gap: '4px', borderColor: border, color: '#D06060' }}
                      >
                        <LuEyeOff size={12} /> Masquer
                      </Button>
                    )}
                    <Button
                      onClick={() => setConfirmHard({ review: r })}
                      title="Supprimer définitivement"
                      className="h-auto rounded-md border px-2 py-1 text-[11px] font-bold"
                      style={{ gap: '4px', borderColor: '#D06060', background: 'rgba(208,96,96,0.08)', color: '#D06060' }}
                    >
                      <LuTrash2 size={12} /> Supprimer
                    </Button>
                  </div>
                </div>

                {/* Corps de l'avis */}
                {r.body && (
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: fg, whiteSpace: 'pre-wrap', paddingLeft: '6px', borderLeft: `2px solid ${border}` }}>
                    {r.body}
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

      {/* Modale raison (masquage) */}
      {actionReview && !confirmHard && (
        <div onClick={() => setActionReview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div {...dialogueAction.proprietes} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', background: darkMode ? '#0F1925' : '#FDFAF6', color: fg, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.40)' }}>
            <h4 id={dialogueAction.titreId} style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Masquer cet avis</h4>
            <p style={{ margin: 0, fontSize: '12px', color: muted }}>
              <strong>{actionReview.review.rating}/5</strong> par {actionReview.review.profile?.username ?? '—'} — {actionReview.review.recipe_id}
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: muted, textTransform: 'uppercase' }}>Raison (audit)</span>
              <textarea value={reasonInput} onChange={e => setReasonInput(e.target.value)}
                placeholder="ex: spam — contenu inapproprié — note hors-sujet…"
                rows={3} maxLength={500}
                style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${border}`, background: cardBg, color: fg, fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <Button
                variant="ghost"
                onClick={() => { setActionReview(null); setReasonInput('') }}
                className="h-auto rounded-lg border bg-transparent px-3.5 py-1.5 text-xs font-semibold hover:bg-transparent"
                style={{ borderColor: border, color: muted }}
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleSoft(actionReview.review)}
                className="h-auto rounded-lg bg-[#D06060] px-3.5 py-1.5 text-xs font-bold text-white"
              >
                Masquer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression définitive */}
      {confirmHard && createPortal(
        <ConfirmDeleteModal
          title="Supprimer définitivement cet avis ?"
          body={`Avis ${confirmHard.review.rating}/5 par ${confirmHard.review.profile?.username ?? '—'} — cette action est irréversible et auditée.`}
          confirmLabel="Supprimer définitivement"
          cancelLabel="Annuler"
          onConfirm={() => handleHard(confirmHard.review)}
          onCancel={() => setConfirmHard(null)}
          darkMode={darkMode}
        />, document.body
      )}
      {confirmBulkSoft && createPortal(
        <ConfirmDeleteModal
          title={`Masquer ${sel.count} avis ?`}
          body="Les avis sélectionnés seront masqués (action réversible, auditée)."
          confirmLabel="Masquer" cancelLabel="Annuler"
          onConfirm={handleBulkSoft} onCancel={() => setConfirmBulkSoft(false)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
