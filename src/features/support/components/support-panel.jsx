import { useId } from 'react'
import { SUPPORT_I18N as I18N } from '@features/support/i18n/support-i18n'
import { LuX, LuMessageSquare, LuPlus, LuChevronLeft, LuChevronRight, LuSend, LuTrash2, LuPencil, LuCheck } from 'react-icons/lu'
import Button from '@shared/ui/button'
import { useDialogue } from '@shared/hooks/use-dialogue'
import { getSelfHelp } from '@features/support/data/support-self-help'
import useSupportPanel from '@features/support/hooks/use-support-panel'
import SupportFormView from './support-form-view'
import SupportConfirmView from './support-confirm-view'
import { formatDateTime } from '@shared/lib/format-date'
import { MESSAGE_SUPPORT_MAX } from '@shared/lib/longueurs-maximales'

// ─── Catégories du flux guidé ─────────────────────────────────────────────────
const CATEGORIES = [
  { id:'report_base',       emoji:'📖', flow:'report', targetType:'recipe',     searchType:'base',       group:'report' },
  { id:'report_community',  emoji:'🧑‍🍳', flow:'report', targetType:'recipe',     searchType:'community',  group:'report' },
  { id:'report_ingredient', emoji:'🥦', flow:'report', targetType:'ingredient', searchType:'ingredient', group:'report' },
  { id:'report_user',       emoji:'👤', flow:'report', targetType:'user',       searchType:'user',       group:'report' },
  { id:'price_error',       emoji:'💰', flow:'report', targetType:'ingredient', searchType:'ingredient', fixedReason:'wrong_info', group:'report' },
  { id:'bug_voice',         emoji:'🎙️', flow:'bug',    ticketType:'question',  group:'bug' },
  { id:'bug_recipe_form',   emoji:'✍️',  flow:'bug',    ticketType:'question',  group:'bug' },
  { id:'bug_profile',       emoji:'⚙️', flow:'bug',    ticketType:'question',  group:'bug' },
  { id:'question',          emoji:'❓', flow:'free',   ticketType:'question',  group:'other' },
  { id:'suggestion',        emoji:'💡', flow:'free',   ticketType:'request',   group:'other' },
]

// ─── i18n ─────────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  open:        { bg:'rgba(251,191,36,0.15)', color:'var(--color-warning)' },
  in_progress: { bg:'rgba(59,130,246,0.12)', color:'var(--color-info)' },
  resolved:    { bg:'rgba(34,197,94,0.12)',  color:'var(--color-success)' },
}

const TYPE_ICONS = { report:'🚩', question:'❓', request:'💡' }
const GROUPS = ['report', 'bug', 'other']

// Delegue au module partage (audit 2026-08-28) : les 17 occurrences codaient
// 'fr-FR' en dur, un admin anglophone lisait des dates francaises.
function fmtDate(str, lang = 'fr') { return str ? formatDateTime(str, lang) : '' }

export default function SupportPanel({ userId, lang = 'fr', darkMode = false, onClose, onUnreadChange }) {
  const t = I18N[lang] ?? I18N.fr
  // Une vraie boîte de dialogue : rôle, nom, focus piégé, Échap (A11Y-01).
  const dialogue = useDialogue({ onClose, nom: t.title })

  const modalBg = darkMode ? '#111B2A' : '#FDFAF6'
  const border  = darkMode ? '#1E2F45' : 'var(--color-border-warm)'
  const text    = darkMode ? '#C8D8E8' : '#2A1A0E'
  const muted   = darkMode ? '#8FA5BC' : '#7E7062'
  const inputBg = darkMode ? '#141F2E' : '#FAF5EE'
  const rowBg   = darkMode ? '#141F2E' : '#FAF5EE'
  // Regroupées pour descendre en une prop vers les vues extraites, comme `ctx`.
  const theme = { darkMode, modalBg, border, text, muted, inputBg, rowBg }

  // L'état, les effets et les actions vivent dans le hook : il retourne un objet
  // unique, destructuré ici pour que les vues gardent leurs noms de variables.
  const ctx = useSupportPanel({ userId, lang, onUnreadChange })
  const champReponseId = useId()
  const {
    view, setView, tickets, selectedTicket, messages,
    replyContent, setReplyContent, sending, error, setError,
    hoveredMsgId, setHoveredMsgId, editingTitle, setEditingTitle,
    titleDraft, setTitleDraft, newFlow, messagesEndRef,
    openTicket, handleSendReply, handleDeleteMessage, handleDeleteTicket,
    handleSaveTitle, goBack, startNewFlow, selectCategory,
  } = ctx

  // ─── Titre du header selon la vue ─────────────────────────────────────────
  function renderHeaderLeft() {
    const canGoBack = view !== 'list'
    const formBack = newFlow.category && getSelfHelp(newFlow.category.id, lang).length > 0 ? 'help' : 'cat'
    const backTarget = view === 'confirm' ? 'form'
      : view === 'form' ? formBack
      : view === 'help' ? 'cat'
      : view === 'cat' ? 'list'
      : 'list'

    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
        {canGoBack && (
          <Button
            variant="ghost"
            onClick={() => { setError(null); if (view === 'detail') goBack(); else setView(backTarget) }}
            className="h-auto shrink-0 rounded-none bg-transparent px-0 py-1 pr-2 text-[13px] hover:bg-transparent"
            style={{ color: muted, gap: '4px' }}>
            <LuChevronLeft size={14} />{t.back}
          </Button>
        )}
        {view === 'list' && <><LuMessageSquare size={15} style={{ color:'var(--color-warm-400)', flexShrink:0 }} /><span style={{ fontSize:15, fontWeight:700, color:text }}>{t.title}</span></>}
        {view === 'cat'  && <span style={{ fontSize:14, fontWeight:700, color:text }}>{t.newTicket}</span>}
        {view === 'help' && newFlow.category && (
          <span style={{ fontSize:13, fontWeight:700, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {newFlow.category.emoji} {t.cats[newFlow.category.id]}
          </span>
        )}
        {view === 'form' && newFlow.category && (
          <span style={{ fontSize:13, fontWeight:700, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {newFlow.category.emoji} {t.cats[newFlow.category.id]}
          </span>
        )}
        {view === 'confirm' && <span style={{ fontSize:14, fontWeight:700, color:text }}>{t.confirmSectionTitle}</span>}
        {view === 'detail' && selectedTicket && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
            {editingTitle ? (
              <>
                <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} aria-label={t.titleInputAria}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  autoFocus maxLength={120}
                  style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:text, background:inputBg, border:'1.5px solid var(--color-warm-400)', borderRadius:7, padding:'4px 9px', outline:'none', fontFamily:'inherit' }}
                />
                <Button
                  onClick={handleSaveTitle}
                  aria-label={t.saveTitleAria}
                  className="h-auto shrink-0 rounded-md px-1.5 py-1 text-white"
                  style={{ background: 'linear-gradient(135deg,#2E4A6A,#1A2F48)' }}
                ><LuCheck size={13} /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingTitle(false)}
                  aria-label={t.cancel}
                  className="h-auto w-auto shrink-0 p-1 hover:bg-transparent"
                  style={{ color: muted }}
                ><LuX size={13} /></Button>
              </>
            ) : (
              <>
                <span style={{ fontSize:13, fontWeight:700, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{selectedTicket.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setTitleDraft(selectedTicket.title); setEditingTitle(true) }}
                  title={t.editTitle}
                  aria-label={t.editTitle}
                  className="h-auto w-auto shrink-0 p-0.5 hover:bg-transparent"
                  style={{ color: muted, opacity: 0.6 }}>
                  <LuPencil size={12} />
                </Button>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, flexShrink:0, ...STATUS_STYLES[selectedTicket.status] }}>{t.status[selectedTicket.status]}</span>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Vues ─────────────────────────────────────────────────────────────────

  // Une action refusée (supprimer un ticket, un message) le dit, quelle que
  // soit la vue. Jusqu'au 2026-10-05 l'erreur n'était affichée que dans le pied
  // d'un ticket ouvert : depuis la liste, un refus ne se voyait pas.
  const alerte = error && (
    <p role="alert" style={{ fontSize:12, color:'var(--color-danger)', margin:'0 0 8px' }}>{error}</p>
  )

  function renderList() {
    return (
      <div style={{ padding:'12px 16px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {alerte}
        {tickets.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 24px', color:muted }}>
            <div style={{ fontSize:32, marginBottom:12, opacity:0.3 }}>💬</div>
            <p style={{ fontSize:14, marginBottom:6, color:text, opacity:0.6 }}>{t.noTickets}</p>
            <p style={{ fontSize:12, opacity:0.5 }}>{t.noTicketsHint}</p>
          </div>
        ) : tickets.map(ticket => (
          // Wrapper relatif : la corbeille vivait DANS le <Button> (interactif
          // imbriqué dans interactif — HTML invalide, et inatteignable au
          // clavier, audit 2026-08-25). Elle devient un vrai bouton FRÈRE,
          // superposé à droite de la rangée.
          <div key={ticket.id} style={{ position:'relative' }}>
          <Button variant="ghost" onClick={() => openTicket(ticket)}
            className="h-auto w-full justify-start rounded-xl border px-3.5 py-3 text-left hover:bg-transparent"
            style={{
              gap: '12px',
              paddingRight: '30px',
              borderColor: ticket.has_unread_user ? 'rgba(212,106,16,0.45)' : border,
              background: rowBg,
              boxShadow: ticket.has_unread_user ? '0 0 0 2px rgba(212,106,16,0.18)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : '#F5EDE0'}
            onMouseLeave={e => e.currentTarget.style.background = rowBg}>
            <span style={{ fontSize:18, flexShrink:0 }}>{TYPE_ICONS[ticket.type] ?? '📩'}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:ticket.has_unread_user ? 700 : 500, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{ticket.title}</span>
                {ticket.has_unread_user && <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--color-brand-600)', flexShrink:0 }} />}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:20, ...STATUS_STYLES[ticket.status] }}>{t.status[ticket.status]}</span>
                <span style={{ fontSize:11, color:muted }}>{fmtDate(ticket.updated_at)}</span>
              </div>
            </div>
            <LuChevronRight size={14} style={{ color:muted, flexShrink:0 }} />
          </Button>
          <button type="button" onClick={() => handleDeleteTicket(ticket.id)} title={t.deleteTicket} aria-label={t.deleteTicket}
            style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none',
              color:'var(--color-danger)', opacity:0.6, cursor:'pointer', display:'flex', alignItems:'center', padding:2 }}>
            <LuTrash2 size={13} />
          </button>
          </div>
        ))}
      </div>
    )
  }

  function renderDetail() {
    if (!selectedTicket) return null
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          {messages.map(msg => (
            <div key={msg.id}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
              style={{ display:'flex', flexDirection:'column', alignItems:msg.is_admin ? 'flex-start' : 'flex-end' }}>
              <span style={{ fontSize:10, color:muted, marginBottom:3 }}>{msg.is_admin ? t.admin : t.you} · {fmtDate(msg.created_at)}</span>
              <div style={{ display:'flex', alignItems:'flex-end', gap:5, flexDirection:msg.is_admin ? 'row' : 'row-reverse', width:'100%' }}>
                <div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius:msg.is_admin ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background:msg.is_admin ? (darkMode ? '#FFFFFF' : 'var(--color-bg-warm)') : 'linear-gradient(135deg,#2E4A6A,#1A2F48)', color:msg.is_admin ? (darkMode ? '#1A1A1A' : text) : 'white', fontSize:13, lineHeight:1.55, whiteSpace:'pre-wrap', overflowWrap:'break-word' }}>
                  {msg.content}
                </div>
                {!msg.is_admin && hoveredMsgId === msg.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMessage(msg.id)}
                    title={t.deleteMessage}
                    aria-label={t.deleteMessage}
                    className="h-auto w-auto shrink-0 p-0.5 hover:bg-transparent"
                    style={{ color: 'var(--color-danger)', opacity: 0.7 }}>
                    <LuTrash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {selectedTicket.status === 'resolved' ? (
          <div style={{ padding:'14px 16px', borderTop:`1px solid ${border}`, textAlign:'center', flexShrink:0 }}>
            {alerte}
            <span style={{ fontSize:12, color:muted, fontStyle:'italic' }}>{t.resolvedNotice}</span>
          </div>
        ) : (
          <div style={{ padding:'12px 16px', borderTop:`1px solid ${border}`, flexShrink:0 }}>
            {alerte}
            {/* Un libellé visible au-dessus de la ligne (champ + envoi), le texte
                grisé en exemple (décision du 2026-10-06). */}
            <label htmlFor={champReponseId} style={{ display:'block', fontSize:12, fontWeight:700, color:muted, marginBottom:6 }}>{t.replyAria}</label>
            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <textarea id={champReponseId} value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder={t.reply} rows={2} maxLength={MESSAGE_SUPPORT_MAX}
                style={{ flex:1, borderRadius:10, border:`1.5px solid ${border}`, background:inputBg, color:text, fontSize:13, padding:'9px 12px', resize:'none', outline:'none', fontFamily:'inherit', transition:'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'var(--color-warm-400)'}
                onBlur={e => e.target.style.borderColor = border}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply() } }}
              />
              <Button
                onClick={handleSendReply}
                loading={sending}
                disabled={!replyContent.trim() || sending}
                aria-label={t.sendReply}
                className="h-10 w-10 shrink-0 rounded-[10px] p-0"
                style={{
                  background: replyContent.trim() && !sending ? 'linear-gradient(135deg,#2E4A6A,#1A2F48)' : (darkMode ? 'var(--color-dark-surface)' : 'var(--color-border-warm)'),
                  color: replyContent.trim() ? 'white' : muted,
                  transition: 'background 0.15s',
                }}>
                <LuSend size={15} />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderCat() {
    return (
      <div style={{ padding:'16px 18px 20px' }}>
        <p style={{ fontSize:13, color:muted, marginBottom:20, textAlign:'center' }}>{t.catTitle}</p>
        {GROUPS.map(group => {
          const groupCats = CATEGORIES.filter(c => c.group === group)
          return (
            <div key={group} style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:muted, marginBottom:8 }}>
                {t.groups[group]}
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {groupCats.map(cat => (
                  <Button key={cat.id} variant="ghost" onClick={() => selectCategory(cat)}
                    className="h-auto justify-start rounded-xl border px-3.5 py-3 text-left hover:bg-transparent"
                    style={{
                      gap: '10px',
                      borderColor: border,
                      background: rowBg,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'var(--color-dark-surface)' : 'var(--color-bg-warm)'; e.currentTarget.style.borderColor = 'var(--color-warm-400)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg; e.currentTarget.style.borderColor = border }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{cat.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:text, lineHeight:1.35 }}>{t.cats[cat.id]}</span>
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderHelp() {
    const { category } = newFlow
    if (!category) return null
    const tips = getSelfHelp(category.id, lang)
    return (
      <div style={{ padding:'16px 18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
        <p style={{ fontSize:13, color:muted, margin:0 }}>{t.helpIntro}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ borderRadius:12, border:`1px solid ${border}`, background:rowBg, padding:'12px 14px' }}>
              <p style={{ fontSize:13, fontWeight:700, color:text, margin:'0 0 5px', display:'flex', gap:7 }}>
                <span aria-hidden="true">💡</span>{tip.q}
              </p>
              <p style={{ fontSize:12.5, color:muted, margin:0, lineHeight:1.55 }}>{tip.a}</p>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
          <Button onClick={() => setView('form')}
            className="h-auto w-full rounded-xl py-2.5 text-[13px] font-semibold"
            style={{ background:'var(--color-warm-500)', color:'#fff' }}>
            {t.helpStillNeed}
          </Button>
          <Button variant="ghost" onClick={onClose}
            className="h-auto w-full rounded-xl border py-2 text-[13px] font-semibold hover:bg-transparent"
            style={{ borderColor:border, color:muted }}>
            {t.helpResolved}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center fp-modal-backdrop"
      style={{ padding:16, background:'rgba(18,10,4,0.60)', backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div
        {...dialogue.proprietes}
        className="fp-modal-panel"
        style={{ width:540, maxWidth:'100%', maxHeight:'88dvh', display:'flex', flexDirection:'column', background:modalBg, borderRadius:20, border:`1px solid ${border}`, boxShadow:darkMode ? '0 16px 48px rgba(0,0,0,0.55)' : '0 16px 48px rgba(0,0,0,0.15)', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${border}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          {renderHeaderLeft()}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {view === 'detail' && selectedTicket && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTicket(selectedTicket.id)}
                title={t.deleteTicket}
                aria-label={t.deleteTicket}
                className="h-auto w-auto p-1 hover:bg-transparent"
                style={{ color: 'var(--color-danger)', opacity: 0.6 }}>
                <LuTrash2 size={15} />
              </Button>
            )}
            {view === 'list' && (
              <Button
                onClick={startNewFlow}
                className="h-auto rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-white"
                style={{ gap: '5px', background: 'linear-gradient(135deg,#2E4A6A,#1A2F48)' }}>
                <LuPlus size={13} />{t.newTicket}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.close}
              className="h-auto w-auto p-0.5 hover:bg-transparent"
              style={{ color: muted, opacity: 0.55 }}>
              <LuX size={17} />
            </Button>
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', minHeight:0 }}>
          {view === 'list'    && renderList()}
          {view === 'detail'  && renderDetail()}
          {view === 'cat'     && renderCat()}
          {view === 'help'    && renderHelp()}
          {view === 'form'    && <SupportFormView    ctx={ctx} theme={theme} t={t} />}
          {view === 'confirm' && <SupportConfirmView ctx={ctx} theme={theme} t={t} />}
        </div>
      </div>
    </div>
  )
}
