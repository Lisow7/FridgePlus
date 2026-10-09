import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  LuCheck, LuClock, LuRefreshCw, LuTrash2, LuBan,
  LuChevronDown, LuChevronUp, LuSend,
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
  getTicketMessages, adminReplyTicket,
} from '@features/support/api/support'
import { adminToggleBan } from '@features/admin/api/admin'
import { useAdmin } from '../../providers/admin-provider'
import { ConfirmDeleteModal, ConfirmActionModal } from '@shared/ui/confirm-dialog/confirm-modals'
import BulkActionBar from '../shared/bulk-action-bar'
import { appliquerEnLot, messageDeLot } from '@features/admin/lib/appliquer-en-lot'
import { useSelection } from '@features/admin/hooks/use-selection'
import Button from '@shared/ui/button'
import { formatDateTime } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'

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
}

// Delegue au module partage (audit 2026-08-28) : les 17 occurrences codaient
// 'fr-FR' en dur, un admin anglophone lisait des dates francaises.
function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }

// ── Conversation inline ───────────────────────────────────────────────────────

function ReportThread({ reportId, lang, darkMode }) {
  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [reply,     setReply]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [replyErr,  setReplyErr]  = useState(null)
  const bottomRef = useRef(null)

  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#7A90A8' : '#5C4033'

  const reload = useCallback(async () => {
    const msgs = await getTicketMessages(reportId)
    setMessages(msgs ?? [])
    setLoading(false)
  }, [reportId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload() }, [reload])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!reply.trim() || sending) return
    setSending(true)
    setReplyErr(null)
    const { error } = await adminReplyTicket(reportId, null, reply.trim(), lang)
    if (error) { setReplyErr('Erreur lors de l\'envoi.') }
    else { setReply(''); reload() }
    setSending(false)
  }

  if (loading) return <p style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>Chargement…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {messages.length === 0 ? (
        <p style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>Aucun message — soyez le premier à répondre.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.is_admin ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, color: muted, marginBottom: 2 }}>
                {msg.is_admin ? 'Admin' : 'Utilisateur'} · {fmtDate(msg.created_at)}
              </span>
              <div style={{ maxWidth: '85%', padding: '7px 11px', borderRadius: msg.is_admin ? '12px 3px 12px 12px' : '3px 12px 12px 12px', background: msg.is_admin ? 'linear-gradient(135deg,#2E4A6A,#1A2F48)' : (darkMode ? '#253545' : 'var(--color-bg-warm)'), color: msg.is_admin ? 'white' : fg, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      {replyErr && <p style={{ fontSize: 11, color: 'var(--color-danger)', margin: 0 }}>{replyErr}</p>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Répondre au signalement…" rows={2}
          style={{ flex: 1, borderRadius: 8, border: `1.5px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 12, padding: '6px 10px', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => e.target.style.borderColor = 'var(--color-brand-500)'}
          onBlur={e => e.target.style.borderColor = border}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <Button
          onClick={send}
          loading={sending}
          disabled={!reply.trim() || sending}
          aria-label="Envoyer"
          className="h-9 w-9 flex-shrink-0 rounded-lg"
          style={{
            background: reply.trim() ? 'linear-gradient(135deg,#2E4A6A,#1A2F48)' : (darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'),
            color: reply.trim() ? 'white' : muted,
          }}
        >
          {!sending && <LuSend size={13} />}
        </Button>
      </div>
    </div>
  )
}

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

  function pillStyle(active, accent = 'var(--color-brand-500)') {
    return {
      borderColor: active ? accent : border,
      background: active ? `${accent}18` : 'transparent',
      color: active ? accent : muted,
      fontWeight: active ? 700 : 500,
      transition: 'all 0.12s',
    }
  }

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

  async function confirmBanUser() {
    const report = confirmBan
    setConfirmBan(null)
    if (!report) return
    const uid = report.user_id
    setBanLoading(p => ({ ...p, [uid]: true }))
    const { error: err } = await adminToggleBan(uid, !report.reporter_banned)
    setBanLoading(p => ({ ...p, [uid]: false }))
    if (err) { setError(err.message); return }
    setReports(rs => rs.map(r => r.user_id === uid ? { ...r, reporter_banned: !report.reporter_banned } : r))
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
          style={pillStyle(statusFilter === '')}
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
            style={pillStyle(statusFilter === key, cfg.color)}
          >
            {cfg.label}
            {counts[key] > 0 && (
              <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 3, background: statusFilter === key ? `${cfg.color}28` : (darkMode ? '#2A4060' : 'var(--color-bg-warm)'), fontSize: 11 }}>
                {counts[key]}
              </span>
            )}
          </Button>
        ))}
        {totalUnread > 0 && (
          <span style={{ padding: '4px 10px', borderRadius: 4, background: 'rgba(229,53,53,0.12)', color: '#E53535', fontSize: 12, fontWeight: 700 }}>
            🔴 {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
          </span>
        )}
        <Button
          variant="ghost"
          onClick={reload}
          disabled={loading}
          className="ml-auto h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
          style={{ ...pillStyle(false), gap: 5 }}
        >
          <LuRefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          Recharger
        </Button>
      </div>

      {/* Filtres type + raison */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ flex: '1 1 160px', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
          <option value="">Toutes les cibles</option>
          {REPORT_TARGET_TYPES.map(t => <option key={t} value={t}>{TARGET_LABELS[t] ?? t}</option>)}
        </select>
        <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
          style={{ flex: '1 1 160px', padding: '7px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
          <option value="">Toutes les raisons</option>
          {REPORT_REASON_KEYS.map(k => <option key={k} value={k}>{REASON_LABELS[k]}</option>)}
        </select>
      </div>

      {statusFilter === 'open' && (
        <BulkActionBar count={sel.count} lang={lang} darkMode={darkMode} onClear={sel.clear}
          actions={[{ label: lang === 'fr' ? 'Marquer résolu' : 'Mark resolved', onClick: handleBulkResolve }]} />
      )}

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
                  <input type="checkbox" checked={sel.isSelected(r.id)} onChange={() => sel.toggle(r.id)}
                    aria-label="Sélectionner ce signalement" style={{ flexShrink: 0, marginLeft: 12, width: 16, height: 16, cursor: 'pointer' }} />
                )}
                <Button
                  variant="ghost"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
                  className="h-auto w-full justify-start rounded-none bg-transparent px-3.5 py-2.5 text-left hover:bg-transparent"
                  style={{ gap: 8, flex: 1, minWidth: 0 }}
                >
                  {r.has_unread_admin && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E53535', flexShrink: 0 }} />}
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sc.label}</span>
                  <span style={{ fontSize: 12, color: muted, flexShrink: 0 }}>{TARGET_LABELS[r.target_type] ?? r.target_type}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.target_label ? `— ${r.target_label}` : r.title}
                  </span>
                  <span style={{ fontSize: 11, color: muted, flexShrink: 0, marginRight: 4 }}>{fmtDate(r.created_at)}</span>
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
                          style={{ ...pillStyle(true, 'var(--color-info)'), gap: 5 }}
                        >
                          <LuClock size={11} /> Prendre en charge
                        </Button>
                      )}
                      {r.status !== 'resolved' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleStatus(r, 'resolved')}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={{ ...pillStyle(true, 'var(--color-success)'), gap: 5 }}
                        >
                          <LuCheck size={11} /> Résoudre
                        </Button>
                      )}
                      {r.status === 'resolved' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleStatus(r, 'open')}
                          className="h-auto flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs hover:bg-transparent"
                          style={pillStyle(false)}
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
                          style={{ ...pillStyle(r.reporter_banned, 'var(--color-danger)'), gap: 5 }}
                        >
                          <LuBan size={11} />{r.reporter_banned ? 'Débannir' : 'Bannir'}
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

      {confirmBan && createPortal(
        <ConfirmActionModal
          title={confirmBan.reporter_banned ? `Débannir ${confirmBan.reporter_username ?? 'cet utilisateur'} ?` : `Bannir ${confirmBan.reporter_username ?? 'cet utilisateur'} ?`}
          body={confirmBan.reporter_banned
            ? 'L\'utilisateur pourra à nouveau accéder à l\'application.'
            : 'L\'utilisateur sera bloqué et ne pourra plus se connecter. Cette action est réversible.'}
          confirmLabel={confirmBan.reporter_banned ? 'Débannir' : 'Bannir'}
          cancelLabel="Annuler"
          onConfirm={confirmBanUser}
          onCancel={() => setConfirmBan(null)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
