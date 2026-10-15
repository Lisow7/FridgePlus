import { useId } from 'react'
import { LuChevronLeft, LuTrash2, LuSend } from 'react-icons/lu'
import Button from '@shared/ui/button'
import FeedbackBanner from '../shared/feedback-banner'
import ChargementRate from '../shared/chargement-rate'
import { MESSAGE_SUPPORT_MAX } from '@shared/lib/longueurs-maximales'
import { SUPPORT_QUICK_REPLIES, quickReplyText } from '@features/admin/data/support-quick-replies'

// La vue « un ticket » de la section Support : en-tête (retour, statut,
// suppression), fil des messages, réponse.
//
// Sortie de `support-section.jsx` le 2026-10-05 : le fichier était à son
// plafond de taille, et la vue devait apprendre à dire que les messages n'ont
// PAS pu être lus — elle affichait « Aucun message dans ce ticket » (audit
// ADM-08). L'état reste dans la section ; ce composant ne fait qu'afficher.
export default function SupportTicketDetail({
  detail, statusCfg, typeCfg, fmtDate,
  messages, messagesError, onRetryMessages,
  bottomRef,
  reply, setReply, sending, replyError,
  onBack, onSetStatus, onRequestDelete, onDeleteMessage, onReply,
  feedback, modaleSuppression, lang, darkMode, fg, muted, border,
}) {
  const sc = statusCfg[detail.status] ?? statusCfg.open
  const tc = typeCfg[detail.type] ?? { icon: '📩', label: detail.type ?? 'Ticket' }
  const reponseId = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 300 }}>
      <FeedbackBanner feedback={feedback} />{modaleSuppression}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button
          variant="ghost"
          onClick={onBack}
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
          {Object.entries(statusCfg).map(([s, cfg]) => (
            <Button
              key={s}
              variant="ghost"
              aria-pressed={detail.status === s}
              onClick={() => onSetStatus(s)}
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
          onClick={onRequestDelete}
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
        {messagesError ? (
          <ChargementRate error={messagesError} onRetry={onRetryMessages} lang={lang} />
        ) : messages.length === 0 && (
          <p style={{ fontSize: 13, color: muted, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
            Aucun message dans ce ticket.
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            style={{ display: 'flex', flexDirection: 'column', alignItems: msg.is_admin ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: muted, marginBottom: 3 }}>
              {msg.is_admin ? 'Admin' : (detail.username ?? 'Utilisateur')} · {fmtDate(msg.created_at)}
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: msg.is_admin ? 'row-reverse' : 'row', width: '100%' }}>
              <div style={{ maxWidth: '80%', padding: '9px 13px', borderRadius: msg.is_admin ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: msg.is_admin ? 'linear-gradient(135deg, #2E4A6A 0%, #1A2F48 100%)' : (darkMode ? '#253545' : 'var(--color-bg-warm)'), color: msg.is_admin ? 'white' : fg, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
                {msg.content}
              </div>
              {/* Suppression disponible sur tous les messages (admin + user) pour RGPD.
                  Toujours là : elle n'existait que pendant le survol, donc ni
                  au clavier ni au toucher (audit du 2026-10-04, ADM-19 c). */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteMessage(msg)}
                title="Supprimer (RGPD)"
                aria-label="Supprimer le message"
                className="h-6 w-6 flex-shrink-0 bg-transparent hover:bg-transparent"
                style={{ color: 'var(--color-danger)' }}
              >
                <LuTrash2 size={12} />
              </Button>
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
            onClick={() => onSetStatus('open')}
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
                {q.label}
              </button>
            ))}
          </div>
          {/* Libellé visible au-dessus de la ligne champ + envoi (décision du 2026-10-06). */}
          <label htmlFor={reponseId} style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', marginBottom: 4 }}>Votre réponse</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea id={reponseId} value={reply} onChange={e => setReply(e.target.value)} placeholder="ex. : Bonjour, c'est corrigé !" rows={2} maxLength={MESSAGE_SUPPORT_MAX}
              style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${border}`, background: darkMode ? '#141F2E' : '#FFF', color: fg, fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = 'var(--color-brand-500)'}
              onBlur={e => e.target.style.borderColor = border}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReply() } }}
            />
            <Button
              onClick={onReply}
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
