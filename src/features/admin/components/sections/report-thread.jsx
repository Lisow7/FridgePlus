import { useEffect, useState, useCallback, useRef, useId } from 'react'
import { LuSend } from 'react-icons/lu'
import { getTicketMessages, adminReplyTicket } from '@features/support/api/support'
import Button from '@shared/ui/button'
import { formatDateTime } from '@shared/lib/format-date'
import ChargementRate from '../shared/chargement-rate'
import { MESSAGE_SUPPORT_MAX } from '@shared/lib/longueurs-maximales'

// La conversation d'un signalement, dépliée sous sa ligne dans la section
// Signalements. Sortie de `reports-section.jsx` le 2026-10-05 (le fichier était
// à 499 lignes) pour apprendre à dire que les messages n'ont PAS pu être lus —
// elle affichait « Aucun message — soyez le premier à répondre » (audit ADM-08).

function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }


export default function ReportThread({ reportId, lang, darkMode }) {
  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [reply,     setReply]     = useState('')
  const reponseId = useId()
  const [sending,   setSending]   = useState(false)
  const [replyErr,  setReplyErr]  = useState(null)
  const [erreurMessages, setErreurMessages] = useState(null)
  const bottomRef = useRef(null)

  const border = darkMode ? '#2A3A50' : '#D9CCBA'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#7A90A8' : '#5C4033'

  const reload = useCallback(async () => {
    const { messages: msgs, error } = await getTicketMessages(reportId)
    if (!error) setMessages(msgs)
    setErreurMessages(error)
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
      {erreurMessages ? (
        <ChargementRate error={erreurMessages} onRetry={reload} lang={lang} />
      ) : messages.length === 0 ? (
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
      {/* Libellé visible au-dessus de la ligne champ + envoi (décision du 2026-10-06). */}
      <label htmlFor={reponseId} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: -4 }}>Répondre au signalement</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea id={reponseId} value={reply} onChange={e => setReply(e.target.value)} placeholder="ex. : Merci, le commentaire a été retiré." rows={2} maxLength={MESSAGE_SUPPORT_MAX}
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
