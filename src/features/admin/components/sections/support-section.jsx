import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  LuChevronLeft, LuChevronRight, LuTrash2, LuSend,
  LuSearch, LuRefreshCw, LuCheck,
} from 'react-icons/lu'
import { useUndo } from '@shared/contexts/undo-provider'
import { useAdmin } from '../../providers/admin-provider'
import {
  adminGetAllTickets, adminReplyTicket, adminSetTicketStatus,
  markTicketReadByAdmin, adminDeleteTicket,
  adminDeleteMessage, adminDeleteAnyMessage, getTicketMessages,
} from '@features/support/api/support'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import Button from '@shared/ui/button'
import { SUPPORT_QUICK_REPLIES, quickReplyText } from '@features/admin/data/support-quick-replies'
import { formatDate, formatDateTime } from '@shared/lib/format-date'
import { useReloader } from '@shared/hooks/use-reloader'

const STATUS_CFG = {
  open:        { label: 'Ouvert',   color: 'var(--color-warning)', bg: 'rgba(251,191,36,0.15)' },
  in_progress: { label: 'En cours', color: 'var(--color-info)', bg: 'rgba(59,130,246,0.12)' },
  resolved:    { label: 'Résolu',   color: 'var(--color-success)', bg: 'rgba(34,197,94,0.12)'  },
}

const TYPE_CFG = {
  report:     { icon: '🚩', label: 'Signalement' },
  question:   { icon: '❓', label: 'Question' },
  request:    { icon: '💡', label: 'Demande' },
  bug:        { icon: '🐛', label: 'Bug' },
  suggestion: { icon: '✨', label: 'Suggestion' },
}

// Delegue au module partage : 17 occurrences codaient 'fr-FR' en dur (audit 2026-08-28).
function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }
function fmtShort(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

export default function SupportSection({ lang = 'fr', darkMode = false }) {
  const { trigger } = useUndo()
  const { setSupportBadge } = useAdmin()

  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg  = darkMode ? '#141F2E' : '#F2E8D8'

  // ── Liste ──────────────────────────────────────────────────────────────
  const [tickets,         setTickets]         = useState([])
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [typeFilter,      setTypeFilter]      = useState('all')
  const [search,          setSearch]          = useState('')
  const [unreadOnly,      setUnreadOnly]      = useState(false)
  const [hiddenTicketIds, setHiddenTicketIds] = useState(() => new Set())
  const [confirmDelete,   setConfirmDelete]   = useState(null)

  // ── Détail ─────────────────────────────────────────────────────────────
  const [detail,       setDetail]       = useState(null)
  const [messages,     setMessages]     = useState([])
  const [reply,        setReply]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [replyError,   setReplyError]   = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => new Set())
  const bottomRef = useRef(null)

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux rechargements laissait le plus ancien écraser le plus récent.
  const { loading, reload: loadTickets } = useReloader(async (estObsolete) => {
    const data = await adminGetAllTickets()
    if (estObsolete()) return
    setTickets(data ?? [])
  }, [])

  useEffect(() => {
    if (detail && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, detail])

  // ── Filtrage client-side ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return tickets.filter(tk => {
      if (hiddenTicketIds.has(tk.id))                          return false
      if (statusFilter !== 'all' && tk.status !== statusFilter) return false
      if (typeFilter   !== 'all' && tk.type   !== typeFilter)   return false
      if (unreadOnly && !tk.has_unread_admin)                   return false
      if (s && !tk.title?.toLowerCase().includes(s) && !tk.username?.toLowerCase().includes(s)) return false
      return true
    })
  }, [tickets, hiddenTicketIds, statusFilter, typeFilter, unreadOnly, search])

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, in_progress: 0, resolved: 0, unread: 0 }
    for (const tk of tickets) {
      if (hiddenTicketIds.has(tk.id)) continue
      c.all++
      if (c[tk.status] !== undefined) c[tk.status]++
      if (tk.has_unread_admin) c.unread++
    }
    return c
  }, [tickets, hiddenTicketIds])

  const visibleMessages = useMemo(
    () => messages.filter(m => !hiddenMsgIds.has(m.id)),
    [messages, hiddenMsgIds]
  )

  // ── Actions tickets ────────────────────────────────────────────────────
  async function openTicket(ticket) {
    setDetail(ticket)
    setReplyError(null)
    setReply('')
    const msgs = await getTicketMessages(ticket.id)
    setMessages(msgs ?? [])
    if (ticket.has_unread_admin) {
      await markTicketReadByAdmin(ticket.id)
      setTickets(prev => prev.map(tk => tk.id === ticket.id ? { ...tk, has_unread_admin: false } : tk))
      setSupportBadge(prev => Math.max(0, prev - 1))
    }
  }

  // ⚠️ N'afficher le changement que si l'écriture a eu lieu — cf. `support-panel-echecs.test.js`.
  async function handleSetStatus(status) {
    if ((await adminSetTicketStatus(detail.id, status))?.error) return
    setDetail(prev => ({ ...prev, status }))
    setTickets(prev => prev.map(tk => tk.id === detail.id ? { ...tk, status } : tk))
  }

  async function handleQuickResolve(ticketId, e) {
    e.stopPropagation()
    if ((await adminSetTicketStatus(ticketId, 'resolved'))?.error) return
    setTickets(prev => prev.map(tk => tk.id === ticketId ? { ...tk, status: 'resolved' } : tk))
  }

  async function handleReply() {
    if (!reply.trim() || sending) return
    setSending(true)
    setReplyError(null)
    const { error } = await adminReplyTicket(detail.id, null, reply.trim(), lang)
    if (error) {
      setReplyError('Erreur lors de l\'envoi.')
    } else {
      setReply('')
      const msgs = await getTicketMessages(detail.id)
      setMessages(msgs ?? [])
      const now = new Date().toISOString()
      setTickets(prev => prev.map(tk =>
        tk.id === detail.id ? { ...tk, has_unread_user: true, status: 'in_progress', updated_at: now } : tk
      ))
      setDetail(prev => ({ ...prev, status: 'in_progress', has_unread_user: true }))
    }
    setSending(false)
  }

  function requestDeleteTicket(ticketId, e) {
    if (e) e.stopPropagation()
    setConfirmDelete(ticketId)
  }

  function confirmDeleteTicket() {
    const id = confirmDelete
    setConfirmDelete(null)
    if (!id) return
    setHiddenTicketIds(prev => { const s = new Set(prev); s.add(id); return s })
    trigger({
      label: 'Ticket supprimé',
      onConfirm: async () => { await adminDeleteTicket(id); setTickets(r => r.filter(x => x.id !== id)) },
      onUndo: () => setHiddenTicketIds(prev => { const s = new Set(prev); s.delete(id); return s }),
    })
    if (detail?.id === id) { setDetail(null); setMessages([]) }
  }

  function handleDeleteMessage(msg) {
    setHiddenMsgIds(prev => { const s = new Set(prev); s.add(msg.id); return s })
    const delFn = msg.is_admin
      ? () => adminDeleteMessage(msg.id)
      : () => adminDeleteAnyMessage(msg.id)
    trigger({
      label: 'Message supprimé',
      onConfirm: async () => { await delFn(); setMessages(prev => prev.filter(m => m.id !== msg.id)) },
      onUndo: () => setHiddenMsgIds(prev => { const s = new Set(prev); s.delete(msg.id); return s }),
    })
  }

  // ── Helpers style ──────────────────────────────────────────────────────
  function pillStyle(active, accent = 'var(--color-brand-500)') {
    return {
      borderColor: active ? accent : border,
      background: active ? `${accent}18` : 'transparent',
      color: active ? accent : muted,
      fontWeight: active ? 700 : 500,
      transition: 'all 0.12s',
    }
  }

  // ── Vue détail ─────────────────────────────────────────────────────────
  if (detail) {
    const sc = STATUS_CFG[detail.status] ?? STATUS_CFG.open
    const tc = TYPE_CFG[detail.type] ?? { icon: '📩', label: detail.type ?? 'Ticket' }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 300 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            onClick={() => { setDetail(null); setMessages([]) }}
            className="h-auto flex-shrink-0 rounded-none bg-transparent py-1 pl-0 pr-2.5 text-[13px] hover:bg-transparent"
            style={{ gap: 4, color: muted }}
          >
            <LuChevronLeft size={13} /> Retour
          </Button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16 }}>{tc.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detail.title}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color, flexShrink: 0 }}>
                {sc.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: muted }}>
              <strong>{detail.username ?? '—'}</strong> · {tc.label} · {fmtDate(detail.created_at)}
            </div>
          </div>

          {/* Sélecteurs statut */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
            {Object.entries(STATUS_CFG).map(([s, cfg]) => (
              <Button
                key={s}
                variant="ghost"
                aria-pressed={detail.status === s}
                onClick={() => handleSetStatus(s)}
                className="h-auto rounded-md border-[1.5px] px-2.5 py-1 text-[11px] hover:bg-transparent"
                style={{
                  borderColor: detail.status === s ? cfg.color : border,
                  background: detail.status === s ? cfg.bg : 'transparent',
                  color: detail.status === s ? cfg.color : muted,
                  fontWeight: detail.status === s ? 700 : 500,
                }}
              >
                {cfg.label}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={e => requestDeleteTicket(detail.id, e)}
            title="Supprimer le ticket"
            aria-label="Supprimer le ticket"
            className="h-auto w-auto flex-shrink-0 rounded-md bg-transparent p-1.5 hover:bg-transparent"
            style={{ color: 'var(--color-danger)' }}
          >
            <LuTrash2 size={14} />
          </Button>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, minHeight: 150 }}>
          {visibleMessages.length === 0 && (
            <p style={{ fontSize: 13, color: muted, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
              Aucun message dans ce ticket.
            </p>
          )}
          {visibleMessages.map(msg => (
            <div key={msg.id}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.is_admin ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, color: muted, marginBottom: 3 }}>
                {msg.is_admin ? 'Admin' : (detail.username ?? 'Utilisateur')} · {fmtDate(msg.created_at)}
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: msg.is_admin ? 'row-reverse' : 'row', width: '100%' }}>
                <div style={{ maxWidth: '80%', padding: '9px 13px', borderRadius: msg.is_admin ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: msg.is_admin ? 'linear-gradient(135deg, #2E4A6A 0%, #1A2F48 100%)' : (darkMode ? '#253545' : 'var(--color-bg-warm)'), color: msg.is_admin ? 'white' : fg, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                  {msg.content}
                </div>
                {/* Suppression disponible sur tous les messages (admin + user) pour RGPD */}
                {hoveredMsgId === msg.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMessage(msg)}
                    title="Supprimer (RGPD)"
                    aria-label="Supprimer le message"
                    className="h-auto w-auto flex-shrink-0 bg-transparent p-0.5 opacity-65 hover:bg-transparent"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    <LuTrash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Répondre / Résolu */}
        {detail.status === 'resolved' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-success)', flex: 1 }}>Ticket résolu.</span>
            <Button
              variant="ghost"
              onClick={() => handleSetStatus('open')}
              className="h-auto rounded-lg border bg-transparent px-3 py-1 text-xs font-semibold hover:bg-transparent"
              style={{ borderColor: border, color: muted }}
            >
              Rouvrir
            </Button>
          </div>
        ) : (
          <div>
            {replyError && <p style={{ fontSize: 12, color: 'var(--color-danger)', margin: '0 0 8px' }}>{replyError}</p>}
            {/* Réponses rapides (#5) — un clic insère un template, éditable ensuite */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {SUPPORT_QUICK_REPLIES.map(q => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setReply(prev => prev.trim() ? `${prev.trimEnd()}\n${quickReplyText(q.id, lang)}` : quickReplyText(q.id, lang))}
                  style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, border: `1px solid ${border}`, background: 'transparent', color: muted, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {q.label[lang] ?? q.label.fr}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Votre réponse…" rows={2}
                style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'var(--color-brand-500)'}
                onBlur={e => e.target.style.borderColor = border}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
              />
              <Button
                onClick={handleReply}
                loading={sending}
                disabled={!reply.trim() || sending}
                aria-label="Envoyer"
                className="h-10 w-10 flex-shrink-0 rounded-[10px]"
                style={{
                  background: reply.trim() ? 'linear-gradient(135deg, #2E4A6A 0%, #1A2F48 100%)' : (darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'),
                  color: reply.trim() ? 'white' : muted,
                }}
              >
                {!sending && <LuSend size={15} />}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vue liste ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          ['all',        'Tous',     'var(--color-brand-500)'],
          ['open',       'Ouvert',   'var(--color-warning)'],
          ['in_progress','En cours', 'var(--color-info)'],
          ['resolved',   'Résolu',   'var(--color-success)'],
        ].map(([key, label, accent]) => (
          <Button
            key={key}
            variant="ghost"
            aria-pressed={statusFilter === key}
            onClick={() => setStatusFilter(key)}
            className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
            style={pillStyle(statusFilter === key, accent)}
          >
            {label}
            {counts[key] > 0 && (
              <span style={{ marginLeft: 5, padding: '1px 5px', borderRadius: 3, background: statusFilter === key ? `${accent}28` : (darkMode ? '#2A4060' : 'var(--color-bg-warm)'), fontSize: 11 }}>
                {counts[key]}
              </span>
            )}
          </Button>
        ))}
        {counts.unread > 0 && (
          <Button
            variant="ghost"
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(v => !v)}
            className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
            style={pillStyle(unreadOnly, '#E53535')}
          >
            🔴 {counts.unread} non lu{counts.unread > 1 ? 's' : ''}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={loadTickets}
          disabled={loading}
          className="ml-auto h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
          style={{ ...pillStyle(false), gap: 4 }}
        >
          <LuRefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          Recharger
        </Button>
      </div>

      {/* Filtre type + recherche */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            aria-pressed={typeFilter === 'all'}
            onClick={() => setTypeFilter('all')}
            className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
            style={pillStyle(typeFilter === 'all')}
          >
            Tous
          </Button>
          {Object.entries(TYPE_CFG).map(([key, tc]) => (
            <Button
              key={key}
              variant="ghost"
              aria-pressed={typeFilter === key}
              onClick={() => setTypeFilter(key)}
              className="h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
              style={pillStyle(typeFilter === key)}
            >
              {tc.icon} {tc.label}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', marginLeft: 'auto' }}>
          <LuSearch size={13} style={{ color: muted, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Titre, utilisateur…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: fg, fontSize: 12, width: 160 }} />
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: muted, fontSize: 13 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '36px 0', color: muted, fontSize: 13, fontStyle: 'italic' }}>
          Aucun ticket{search ? ` pour « ${search} »` : ''}.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map(ticket => {
            const sc = STATUS_CFG[ticket.status] ?? STATUS_CFG.open
            const tc = TYPE_CFG[ticket.type] ?? { icon: '📩', label: ticket.type ?? 'Ticket' }
            return (
              <Button
                key={ticket.id}
                variant="ghost"
                onClick={() => openTicket(ticket)}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'}
                onMouseLeave={e => e.currentTarget.style.background = rowBg}
                className="h-auto w-full justify-start rounded-[10px] border px-3.5 py-2.5 text-left hover:bg-transparent"
                style={{
                  gap: 10,
                  background: rowBg,
                  borderColor: ticket.has_unread_admin ? 'var(--color-info)' : border,
                  transition: 'background 0.15s',
                }}
              >
                <span title={tc.label} style={{ fontSize: 16, flexShrink: 0 }}>{tc.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: ticket.has_unread_admin ? 700 : 600, color: fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {ticket.title}
                    </span>
                    {ticket.has_unread_admin && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-info)', flexShrink: 0 }} title="Nouveau message" />
                    )}
                    {ticket.has_unread_user && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(212,106,16,0.15)', color: 'var(--color-brand-600)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Rép. utilisateur
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    <span style={{ fontSize: 11, color: muted }}>{ticket.username ?? '—'}</span>
                    <span style={{ fontSize: 11, color: muted }}>{fmtShort(ticket.updated_at ?? ticket.created_at)}</span>
                  </div>
                </div>

                {/* Résoudre en un clic */}
                {ticket.status !== 'resolved' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => handleQuickResolve(ticket.id, e)}
                    title="Marquer résolu"
                    aria-label="Marquer résolu"
                    className="h-auto w-auto flex-shrink-0 rounded-[7px] border px-2 py-1 hover:bg-transparent"
                    style={{
                      borderColor: 'rgba(22,163,74,0.35)',
                      background: 'rgba(22,163,74,0.08)',
                      color: 'var(--color-success)',
                    }}
                  >
                    <LuCheck size={12} />
                  </Button>
                )}

                <LuChevronRight size={13} style={{ color: muted, flexShrink: 0 }} />

                <span onClick={e => requestDeleteTicket(ticket.id, e)} title="Supprimer"
                  style={{ color: 'var(--color-danger)', opacity: 0.65, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, padding: 2 }}>
                  <LuTrash2 size={13} />
                </span>
              </Button>
            )
          })}
        </div>
      )}

      {confirmDelete && createPortal(
        <ConfirmDeleteModal
          title="Supprimer ce ticket ?"
          body="Le ticket et tous ses messages seront supprimés définitivement. Tu as 10 secondes pour annuler."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          onConfirm={confirmDeleteTicket}
          onCancel={() => setConfirmDelete(null)}
          darkMode={darkMode}
        />, document.body
      )}
    </div>
  )
}
