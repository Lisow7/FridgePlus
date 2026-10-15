import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LuCheck, LuClock, LuRefreshCw, LuTrash2, LuBan,
  LuChevronDown, LuChevronUp,
} from 'react-icons/lu'
import {
  adminGetReports,
  REPORT_TARGET_TYPES, REPORT_REASON_KEYS,
} from '@shared/api/reports'
// adminUpdateReportStatus / adminDeleteReport ne sont que des aliases
// renommés de adminSetTicketStatus / adminDeleteTicket dans support
// (les signalements vivent dans support_tickets côté BDD).
import {
  adminSetTicketStatus as adminUpdateReportStatus,
  adminDeleteTicket    as adminDeleteReport,
} from '@features/support/api/support'
import { adminBannir, adminDebannir, notifierLeBannissement } from '@features/admin/api/bannissement'
import FenetreDeBannissement from '../modals/fenetre-de-bannissement'
import { useAdmin } from '../../providers/admin-provider'
import { ConfirmDeleteModal, ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import BulkActionBar from '../shared/bulk-action-bar'
import CaseDeSelection from '../shared/case-de-selection'
import { appliquerEnLot, messageDeLot } from '@features/admin/lib/appliquer-en-lot'
import { useSelection } from '@features/admin/hooks/use-selection'
import Button from '@shared/ui/button'
import { fmtDateTime } from '@features/admin/lib/dates'
import { useReloader } from '@shared/hooks/use-reloader'
import ReportThread from './report-thread'
import { texteLisible, fondTeinte } from '@shared/lib/couleurs/texte-lisible'
import { stylePastille } from '@features/admin/lib/pastille'

const REASON_LABELS = {
  spam:           'Spam',
  inappropriate:  'Contenu inapproprié',
  allergen_error: "Erreur d'allergène",
  wrong_info:     'Information erronée',
  plagiarism:     'Plagiat',
  harassment:     'Harcèlement',
  other:          'Autre',
}

const STATUS_CFG = {
  open:        { label: 'Ouvert',   color: 'var(--color-warning)', bg: 'rgba(251,191,36,0.15)' },
  in_progress: { label: 'En cours', color: 'var(--color-info)', bg: 'rgba(59,130,246,0.12)' },
  resolved:    { label: 'Résolu',   color: 'var(--color-success)', bg: 'rgba(34,197,94,0.12)'  },
}

const TARGET_LABELS = {
  recipe:          '🍳 Recette',
  user:            '👤 Utilisateur',
  comment:         '💬 Commentaire',
  ingredient:      '🥬 Ingrédient',
  community_post:  '📝 Post communauté',
  community_reply: '💬 Réponse communauté',
  community_profile: '👤 Profil communauté',
  recipe_review:   '⭐ Avis sur une recette',
}

// Delegue au module partage (audit 2026-08-28) : les 17 occurrences codaient
// 'fr-FR' en dur, un admin anglophone lisait des dates francaises.

// ── Section principale ────────────────────────────────────────────────────────

export default function ReportsSection({ lang = 'fr', darkMode = false }) {
  const { setReportsCount } = useAdmin()
  const sel = useSelection()

  const [reports,       setReports]       = useState([])
  const [statusFilter,  setStatusFilter]  = useState('open')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [reasonFilter,  setReasonFilter]  = useState('')
  const [error,         setError]         = useState(null)
  const [expanded,      setExpanded]      = useState({})
  const [banLoading,    setBanLoading]    = useState({})

  // Modales de confirmation
  const [confirmDelete, setConfirmDelete] = useState(null) // report object
  const [confirmBan,    setConfirmBan]    = useState(null) // report object

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  const { loading, reload } = useReloader(async (estObsolete) => {
    setError(null)
    const { data, error: err } = await adminGetReports({
      status:     statusFilter || null,
      targetType: typeFilter   || null,
      reasonKey:  reasonFilter || null,
    })
    if (estObsolete()) return
    if (err) setError(err.message)
    else     setReports(data)
  }, [statusFilter, typeFilter, reasonFilter])

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0 }
    for (const r of reports) if (c[r.status] !== undefined) c[r.status]++
    return c
  }, [reports])

  const totalUnread = useMemo(() => reports.filter(r => r.has_unread_admin).length, [reports])

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleStatus(report, newStatus) {
    const { error: err } = await adminUpdateReportStatus(report.id, newStatus)
    if (err) { setError(err.message); return }
    setReports(rs => rs.map(r => r.id === report.id
      ? { ...r, status: newStatus, ...(newStatus === 'resolved' ? { has_unread_admin: false } : {}) }
      : r
    ))
    if (newStatus === 'resolved') {
      setReportsCount(prev => Math.max(0, prev - 1))
    }
  }

  async function handleBulkResolve() {
    const ids = sel.ids
    if (!ids.length) return
    // Les resultats etaient jetes, ET les lignes retirees sans condition : des
    // signalements restes ouverts disparaissaient de la file. L'action UNITAIRE
    // juste au-dessus verifie pourtant son erreur (`handleStatus`).
    const bilan = await appliquerEnLot(ids, id => adminUpdateReportStatus(id, 'resolved'))
    if (bilan.toutReussi) {
      setReports(rs => rs.filter(r => !sel.selected.has(r.id)))
      setReportsCount(prev => Math.max(0, prev - bilan.reussis))
    } else {
      setError(messageDeLot(bilan, n => `signalement${n > 1 ? 's' : ''} résolu${n > 1 ? 's' : ''}`))
      reload()
    }
    sel.clear()
  }

  function handleDeleteClick(report, e) {
    e?.stopPropagation()
    setConfirmDelete(report)
  }

  async function confirmDeleteReport() {
    const report = confirmDelete
    setConfirmDelete(null)
    if (!report) return
    const { error: err } = await adminDeleteReport(report.id)
    if (err) { setError(err.message); return }
    setReports(rs => rs.filter(r => r.id !== report.id))
  }

  function handleBanClick(report, e) {
    e?.stopPropagation()
    setConfirmBan(report)
  }

  // Débannir : une confirmation. Bannir : la fenêtre motif + durée, par la
  // base (audit du 2026-10-04, lot 3c-3b).
  async function confirmBanUser() {
    const report = confirmBan
    setConfirmBan(null)
    if (!report) return
    const uid = report.user_id
    setBanLoading(p => ({ ...p, [uid]: true }))
    const { error: err } = await adminDebannir(uid)
    setBanLoading(p => ({ ...p, [uid]: false }))
    if (err) { setError(err.message); return }
    setReports(rs => rs.map(r => r.user_id === uid ? { ...r, reporter_banned: false } : r))
  }

  async function bannirLeSignaleur({ motif, jours }) {
    const uid = confirmBan.user_id
    const { error: err } = await adminBannir(uid, motif, jours)
    if (err) return { error: err }
    setConfirmBan(null)
    setReports(rs => rs.map(r => r.user_id === uid ? { ...r, reporter_banned: true } : r))
    const { envoye } = await notifierLeBannissement(uid)
    if (!envoye) setError('Le signaleur est banni, mais l’e-mail n’a pas pu partir : préviens-le autrement.')
    return { error: null }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {error && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', fontSize: 13 }}>{error}</div>
      )}

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="ghost"
          aria-pressed={statusFilter === ''}
          onClick={() => setStatusFilter('')}
          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
          style={stylePastille(statusFilter === '', { border, muted })}
        >
          Tous
        </Button>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <Button
            key={key}
            variant="ghost"
            aria-pressed={statusFilter === key}
            onClick={() => setStatusFilter(key)}
            className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
            style={stylePastille(statusFilter === key, { accent: cfg.color, border, muted })}
          >
            {cfg.label}
            {counts[key] > 0 && (
              <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 3, background: statusFilter === key ? fondTeinte(cfg.color, 16) : (darkMode ? '#2A4060' : 'var(--color-bg-warm)'), fontSize: 11 }}>
                {counts[key]}
              </span>
            )}
          </Button>
        ))}
        {totalUnread > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(229,53,53,0.12)', color: texteLisible('#E53535'), fontSize: 12, fontWeight: 700 }}>
            🔴 {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
          </span>
        )}
        <Button
          variant="ghost"
          onClick={reload}
          disabled={loading}
          className="ml-auto h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
          style={{ ...stylePastille(false, { border, muted }), gap: 5 }}
        >
          <LuRefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
          Recharger
        </Button>
      </div>

      {/* Filtres type + raison */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Filtrer par cible" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ flex: '1 1 160px', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
          <option value="">Toutes les cibles</option>
          {REPORT_TARGET_TYPES.map(t => <option key={t} value={t}>{TARGET_LABELS[t] ?? t}</option>)}
        </select>
        <select aria-label="Filtrer par raison" value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
          style={{ flex: '1 1 160px', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
          <option value="">Toutes les raisons</option>
          {REPORT_REASON_KEYS.map(k => <option key={k} value={k}>{REASON_LABELS[k]}</option>)}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ padding: '28px', color: muted, textAlign: 'center', fontSize: 13 }}>Chargement…</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: '36px 18px', borderRadius: 12, background: rowBg, border: `1px solid ${border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 28, opacity: 0.45, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 13, color: muted, fontStyle: 'italic' }}>
            Aucun signalement{statusFilter ? ` « ${STATUS_CFG[statusFilter]?.label} »` : ''}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {reports.map(r => {
            const sc     = STATUS_CFG[r.status] ?? STATUS_CFG.open
            const isOpen = expanded[r.id] ?? false
            return (
              <div key={r.id} style={{ borderRadius: 10, background: rowBg, border: `1px solid ${r.has_unread_admin ? '#E53535' : border}`, overflow: 'hidden' }}>

                {/* Header condensé (+ case de sélection si file ouverte) */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                {statusFilter === 'open' && (
                  <CaseDeSelection cochee={sel.isSelected(r.id)} onBasculer={() => sel.toggle(r.id)} nom="Sélectionner ce signalement" style={{ marginLeft: 8 }} />
                )}
                <Button
                  variant="ghost"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
                  className="h-auto w-full justify-start rounded-none bg-transparent px-3.5 py-2.5 text-left hover:bg-transparent"
                  style={{ gap: 8, flex: 1, minWidth: 0 }}
                >
                  {r.has_unread_admin && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E53535', flexShrink: 0 }} />}
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: sc.bg, color: texteLisible(sc.color), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sc.label}</span>
                  <span style={{ fontSize: 12, color: muted, flexShrink: 0 }}>{TARGET_LABELS[r.target_type] ?? r.target_type}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.target_label ? `— ${r.target_label}` : r.title}
                  </span>
                  <span style={{ fontSize: 11, color: muted, flexShrink: 0, marginRight: 4 }}>{fmtDateTime(r.created_at)}</span>
                  {isOpen ? <LuChevronUp size={13} style={{ color: muted, flexShrink: 0 }} /> : <LuChevronDown size={13} style={{ color: muted, flexShrink: 0 }} />}
                </Button>
                </div>

                {/* Détail */}
                {isOpen && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ height: 1, background: border }} />

                    {/* Métadonnées */}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: muted }}>
                      {r.target_label && (
                        <span>Cible : <strong style={{ color: fg }}>{r.target_label}</strong>
                          {r.target_id && <span style={{ fontFamily: 'monospace', fontSize: 11, marginLeft: 6, opacity: 0.6 }}>{r.target_id.slice(0, 8)}…</span>}
                        </span>
                      )}
                      {r.reason_key && (
                        <span>Raison : <strong style={{ color: fg }}>{REASON_LABELS[r.reason_key] ?? r.reason_key}</strong></span>
                      )}
                      <span>
                        Par :{' '}
                        {r.reporter_username
                          ? <strong style={{ color: r.reporter_banned ? 'var(--color-danger)' : fg }}>{r.reporter_username}{r.reporter_banned ? ' (banni)' : ''}</strong>
                          : r.user_id ? <span style={{ fontFamily: 'monospace' }}>{r.user_id.slice(0, 8)}…</span> : <em>compte supprimé</em>
                        }
                      </span>
                    </div>

                    {/* Actions statut */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {r.status === 'open' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleStatus(r, 'in_progress')}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={{ ...stylePastille(true, { accent: 'var(--color-info)', border, muted }), gap: 5 }}
                        >
                          <LuClock size={11} /> Prendre en charge
                        </Button>
                      )}
                      {r.status !== 'resolved' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleStatus(r, 'resolved')}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={{ ...stylePastille(true, { accent: 'var(--color-success)', border, muted }), gap: 5 }}
                        >
                          <LuCheck size={11} /> Résoudre
                        </Button>
                      )}
                      {r.status === 'resolved' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleStatus(r, 'open')}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={stylePastille(false, { border, muted })}
                        >
                          Rouvrir
                        </Button>
                      )}
                      {r.user_id && (
                        <Button
                          variant="ghost"
                          onClick={e => handleBanClick(r, e)}
                          disabled={!!banLoading[r.user_id]}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={{ ...stylePastille(r.reporter_banned, { accent: 'var(--color-danger)', border, muted }), gap: 5 }}
                        >
                          {/* Ce bouton agit sur l'auteur du SIGNALEMENT (`r.user_id`), pas sur
                              celui du contenu signalé : le libellé le dit (audit 2026-10-04,
                              ADM-15 — un clic de modération naturel bannissait le plaignant). */}
                          <LuBan size={11} />{r.reporter_banned ? 'Débannir le signaleur' : 'Bannir le signaleur'}
                          {banLoading[r.user_id] && <span style={{ fontSize: 10 }}>…</span>}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={e => handleDeleteClick(r, e)}
                        aria-label="Supprimer le signalement"
                        className="ml-auto h-auto w-auto rounded-lg bg-transparent px-2 py-1.5 hover:bg-transparent"
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <LuTrash2 size={13} />
                      </Button>
                    </div>

                    {/* Fil de conversation inline */}
                    <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        Conversation
                      </div>
                      <ReportThread reportId={r.id} lang={lang} darkMode={darkMode} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {statusFilter === 'open' && (
        <BulkActionBar count={sel.count} lang={lang} darkMode={darkMode} onClear={sel.clear}
          actions={[{ label: 'Marquer résolu', onClick: handleBulkResolve }]} />
      )}

      {/* Modales */}
      {confirmDelete && createPortal(
        <ConfirmDeleteModal
          title="Supprimer ce signalement ?"
          body="Le signalement et son fil de conversation seront supprimés définitivement."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={confirmDeleteReport}
          onCancel={() => setConfirmDelete(null)}
          darkMode={darkMode}
        />, document.body
      )}

      {confirmBan?.reporter_banned && createPortal(
        <ConfirmActionModal
          title={`Débannir ${confirmBan.reporter_username ?? 'ce signaleur'} ?`}
          body="La personne qui a fait ce signalement pourra à nouveau se connecter, publier et écrire au support."
          confirmLabel="Débannir le signaleur"
          cancelLabel="Annuler"
          onConfirm={confirmBanUser}
          onCancel={() => setConfirmBan(null)}
          darkMode={darkMode}
        />, document.body
      )}
      {confirmBan && !confirmBan.reporter_banned && (
        // Tu bannis la personne qui a FAIT ce signalement, pas l'auteur du contenu signalé.
        <FenetreDeBannissement username={confirmBan.reporter_username ?? 'ce signaleur'} darkMode={darkMode} onBannir={bannirLeSignaleur} onClose={() => setConfirmBan(null)} />
      )}
    </div>
  )
}
