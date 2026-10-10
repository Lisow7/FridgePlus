import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuSearch, LuRefreshCw } from 'react-icons/lu'
import { useUndo } from '@shared/contexts/undo-provider'
import { useAdmin } from '../../providers/admin-provider'
import {
  adminGetAllTickets, adminReplyTicket, adminSetTicketStatus,
  markTicketReadByAdmin, adminDeleteTicket,
  adminDeleteMessage, adminDeleteAnyMessage, getTicketMessages,
} from '@features/support/api/support'
import { ConfirmDeleteModal } from '@shared/ui/confirm-dialog/confirm-modals'
import Button from '@shared/ui/button'
import { formatDate } from '@shared/lib/format-date'
import { fmtDateTime } from '@features/admin/lib/dates'
import { useReloader } from '@shared/hooks/use-reloader'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import SupportTicketDetail from './support-ticket-detail'
import SupportTicketRow from './support-ticket-row'
import { useFeedback } from '@features/admin/hooks/use-feedback'
import { supprimerAvecAnnulation, messageErreurAdmin } from '@features/admin/lib/ecritures-admin'
import { fondTeinte } from '@shared/lib/couleurs/texte-lisible'
import { stylePastille } from '@features/admin/lib/pastille'

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
function fmtShort(str, lang = 'fr') { return str ? formatDate(str, lang) : '' }

export default function SupportSection({ lang = 'fr', darkMode = false }) {
  const { trigger } = useUndo()
  const { setSupportBadge } = useAdmin()
  const [feedback, showFeedback] = useFeedback()

  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#7A90A8' : '#5C4033'
  const rowBg  = darkMode ? '#141F2E' : '#F2E8D8'

  // ── Liste ──────────────────────────────────────────────────────────────
  const [tickets,         setTickets]         = useState([])
  const [statusFilter,    setStatusFilter]    = useState('all')
  const [typeFilter,      setTypeFilter]      = useState('all')
  const [search,          setSearch]          = useState('')
  const rechercheId = useId()
  const [unreadOnly,      setUnreadOnly]      = useState(false)
  const [hiddenTicketIds, setHiddenTicketIds] = useState(() => new Set())
  const [confirmDelete,   setConfirmDelete]   = useState(null)

  // ── Détail ─────────────────────────────────────────────────────────────
  const [detail,       setDetail]       = useState(null)
  const [messages,     setMessages]     = useState([])
  const [reply,        setReply]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [replyError,   setReplyError]   = useState(null)
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => new Set())
  const [messagesError, setMessagesError] = useState(null)
  const bottomRef = useRef(null)
  // L'identifiant du ticket ouvert, pour jeter une réponse arrivée trop tard (ADM-14).
  const ouvertRef = useRef(null)

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux rechargements laissait le plus ancien écraser le plus récent.
  const { loading, error: erreurChargement, reload: loadTickets } = useReloader(async (estObsolete) => {
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
    ouvertRef.current = ticket.id
    setDetail(ticket)
    setReplyError(null)
    setReply('')
    const { messages: msgs, error: errMessages } = await getTicketMessages(ticket.id)
    // Un autre ticket a été ouvert (ou la liste reprise) pendant le chargement :
    // ces messages n'ont rien à faire sous cet en-tête, et « Répondre » partirait
    // vers le mauvais ticket (ADM-14).
    if (ouvertRef.current !== ticket.id) return
    setMessages(msgs)
    setMessagesError(errMessages)
    // La pastille ne baisse que si la base a marqué le ticket « lu » (audit ADM-02).
    if (ticket.has_unread_admin && !(await markTicketReadByAdmin(ticket.id))?.error) {
      setTickets(prev => prev.map(tk => tk.id === ticket.id ? { ...tk, has_unread_admin: false } : tk))
      setSupportBadge(prev => Math.max(0, prev - 1))
    }
  }

  // ⚠️ N'afficher le changement que si l'écriture a eu lieu — cf. `support-panel-echecs.test.js`.
  // Un refus est DIT (il ne se passait rien : on pouvait croire le clic perdu).
  async function handleSetStatus(status) {
    const { error } = (await adminSetTicketStatus(detail.id, status)) ?? {}
    if (error) { showFeedback(false, messageErreurAdmin(error, lang)); return }
    setDetail(prev => ({ ...prev, status }))
    setTickets(prev => prev.map(tk => tk.id === detail.id ? { ...tk, status } : tk))
  }

  // Un refus de la base est DIT (il ne se passait rien : on pouvait croire le
  // clic perdu, et recliquer).
  async function handleQuickResolve(ticketId) {
    const { error } = (await adminSetTicketStatus(ticketId, 'resolved')) ?? {}
    if (error) { showFeedback(false, messageErreurAdmin(error, lang)); return }
    setTickets(prev => prev.map(tk => tk.id === ticketId ? { ...tk, status: 'resolved' } : tk))
  }

  async function handleReply() {
    if (!reply.trim() || sending) return
    setSending(true)
    setReplyError(null)
    const id = detail.id
    // Dans la langue du membre (celle de son profil), pas celle de l'admin (ADM-14).
    const { error, emailError } = await adminReplyTicket(id, null, reply.trim(), detail.language ?? 'fr')
    if (error) {
      setReplyError('Erreur lors de l\'envoi.')
    } else {
      setReply('')
      const { messages: msgs, error: errMessages } = await getTicketMessages(id)
      if (ouvertRef.current !== id) { setSending(false); return }
      if (!errMessages) setMessages(msgs)
      setMessagesError(errMessages)
      const now = new Date().toISOString()
      setTickets(prev => prev.map(tk =>
        tk.id === id ? { ...tk, has_unread_user: true, status: 'in_progress', updated_at: now } : tk
      ))
      setDetail(prev => ({ ...prev, status: 'in_progress', has_unread_user: true }))
      // La réponse est enregistrée ; si l'e-mail n'est pas parti, l'admin le sait
      // (il peut prévenir autrement — avant, l'échec était jeté).
      if (emailError) showFeedback(false, 'Réponse enregistrée, mais l’e-mail au membre n’est pas parti.')
    }
    setSending(false)
  }

  function requestDeleteTicket(ticketId) { setConfirmDelete(ticketId) }

  function confirmDeleteTicket() {
    const id = confirmDelete
    setConfirmDelete(null)
    if (!id) return
    supprimerAvecAnnulation(trigger, {
      label: 'Ticket supprimé', id, setMasques: setHiddenTicketIds,
      supprimer: () => adminDeleteTicket(id),
      retirer: () => setTickets(r => r.filter(x => x.id !== id)),
      siEchec: (e) => showFeedback(false, messageErreurAdmin(e, lang)),
    })
    if (detail?.id === id) { ouvertRef.current = null; setDetail(null); setMessages([]) }
  }

  function handleDeleteMessage(msg) {
    supprimerAvecAnnulation(trigger, {
      label: 'Message supprimé', id: msg.id, setMasques: setHiddenMsgIds,
      supprimer: () => (msg.is_admin ? adminDeleteMessage(msg.id) : adminDeleteAnyMessage(msg.id)),
      retirer: () => setMessages(prev => prev.filter(m => m.id !== msg.id)),
      siEchec: (e) => showFeedback(false, messageErreurAdmin(e, lang)),
    })
  }

  // ── Helpers style ──────────────────────────────────────────────────────
  // Dans les DEUX vues : rendue seulement dans la liste, « Supprimer le ticket » n'ouvrait rien en détail.
  const modaleSuppression = confirmDelete && createPortal(
    <ConfirmDeleteModal
      title="Supprimer ce ticket ?"
      body="Le ticket et tous ses messages seront supprimés définitivement. Tu as 10 secondes pour annuler."
      confirmLabel="Supprimer"
      cancelLabel="Annuler"
      onConfirm={confirmDeleteTicket}
      onCancel={() => setConfirmDelete(null)}
      darkMode={darkMode}
    />, document.body
  )
  // ── Vue détail ─────────────────────────────────────────────────────────
  if (detail) {
    return (
      <SupportTicketDetail
        detail={detail} statusCfg={STATUS_CFG} typeCfg={TYPE_CFG} fmtDate={fmtDateTime}
        messages={visibleMessages} messagesError={messagesError} onRetryMessages={() => openTicket(detail)}
        bottomRef={bottomRef}
        reply={reply} setReply={setReply} sending={sending} replyError={replyError}
        onBack={() => { ouvertRef.current = null; setDetail(null); setMessages([]); setMessagesError(null) }} onSetStatus={handleSetStatus}
        onRequestDelete={() => requestDeleteTicket(detail.id)} onDeleteMessage={handleDeleteMessage} onReply={handleReply}
        feedback={feedback} modaleSuppression={modaleSuppression} lang={lang} darkMode={darkMode} fg={fg} muted={muted} border={border}
      />
    )
  }

  // ── Vue liste ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FeedbackBanner feedback={feedback} />
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
            style={stylePastille(statusFilter === key, { accent: accent, border, muted })}
          >
            {label}
            {counts[key] > 0 && (
              <span style={{ marginLeft: 5, padding: '1px 5px', borderRadius: 3, background: statusFilter === key ? fondTeinte(accent, 16) : (darkMode ? '#2A4060' : 'var(--color-bg-warm)'), fontSize: 11 }}>
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
            style={stylePastille(unreadOnly, { accent: '#E53535', border, muted })}
          >
            🔴 {counts.unread} non lu{counts.unread > 1 ? 's' : ''}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={loadTickets}
          disabled={loading}
          className="ml-auto h-auto rounded-md border px-2.5 py-1 text-xs hover:bg-transparent"
          style={{ ...stylePastille(false, { border, muted }), gap: 4 }}
        >
          <LuRefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
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
            style={stylePastille(typeFilter === 'all', { border, muted })}
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
              style={stylePastille(typeFilter === key, { border, muted })}
            >
              {tc.icon} {tc.label}
            </Button>
          ))}
        </div>
        {/* Libellé visible à gauche, à la hauteur des pastilles (décision du 2026-10-06). */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 6px', marginLeft: 'auto' }}>
          <label htmlFor={rechercheId} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>Rechercher une demande</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF' }}>
            <LuSearch size={13} style={{ color: muted, flexShrink: 0 }} />
            <input id={rechercheId} value={search} onChange={e => setSearch(e.target.value)} placeholder="titre ou utilisateur"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: fg, fontSize: 12, width: 160, padding: '9px 0' }} />
          </div>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: muted, fontSize: 13 }}>Chargement…</div>
      ) : erreurChargement ? (
        <ChargementRate error={erreurChargement} onRetry={loadTickets} lang={lang} />
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '36px 0', color: muted, fontSize: 13, fontStyle: 'italic' }}>
          Aucun ticket{search ? ` pour « ${search} »` : ''}.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {filtered.map(ticket => (
            <SupportTicketRow
              key={ticket.id}
              ticket={ticket} statusCfg={STATUS_CFG} typeCfg={TYPE_CFG}
              date={fmtShort(ticket.updated_at ?? ticket.created_at, lang)}
              onOpen={openTicket} onQuickResolve={handleQuickResolve} onRequestDelete={requestDeleteTicket}
              darkMode={darkMode} rowBg={rowBg} fg={fg} muted={muted} border={border}
            />
          ))}
        </div>
      )}

      {modaleSuppression}
    </div>
  )
}
