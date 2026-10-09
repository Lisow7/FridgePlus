import { useState, useEffect, useRef } from 'react'
import { SUPPORT_I18N as I18N } from '@features/support/i18n/support-i18n'
import {
  getUserTickets, getTicketMessages, createTicket,
  sendUserMessage, markTicketReadByUser, deleteUserMessage,
  deleteUserTicket, updateTicketTitle,
  searchBaseRecipes, searchCommunityRecipes, searchIngredients, searchUsersForReport,
} from '@features/support/api/support'
import { createReport } from '@shared/api/reports'
import { moderateContent } from '@shared/hooks/use-moderation'
import { getSelfHelp } from '@features/support/data/support-self-help'
import { useConfirm } from '@shared/ui/confirm-dialog/confirm-provider'

const FLOW_INIT = { category:null, target:null, searchQuery:'', searchResults:[], searchLoading:false, reasonKey:'', details:'', freeTitle:'' }

/**
 * État, effets et actions du panneau Support.
 *
 * Le panneau est une machine à 6 vues (`list`, `detail`, `cat`, `help`, `form`,
 * `confirm`) dont les vues sont des closures sur cet état — les extraire sans
 * sortir l'état d'abord imposerait 10 à 20 props par vue.
 *
 * Retourne un objet unique et cohérent : il se transmet en une seule prop aux
 * futurs composants de vue, plutôt qu'en une liste de props à rallonge.
 */
export default function useSupportPanel({ userId, lang = 'fr', onUnreadChange }) {
  const t = I18N[lang] ?? I18N.fr
  const confirm = useConfirm()

  const [view,           setView]           = useState('list')
  const [tickets,        setTickets]        = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [messages,       setMessages]       = useState([])
  const [replyContent,   setReplyContent]   = useState('')
  const [sending,        setSending]        = useState(false)
  const [error,          setError]          = useState(null)
  const [hoveredMsgId,   setHoveredMsgId]   = useState(null)
  const [editingTitle,   setEditingTitle]   = useState(false)
  const [titleDraft,     setTitleDraft]     = useState('')
  const [newFlow,        setNewFlow]        = useState(FLOW_INIT)
  const messagesEndRef = useRef(null)

  useEffect(() => { getUserTickets(userId).then(setTickets) }, [userId])

  useEffect(() => {
    if (view === 'detail' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior:'smooth' })
    }
  }, [messages, view])

  // Debounce search dans le formulaire de signalement
  useEffect(() => {
    const cat = newFlow.category
    if (!cat?.searchType) return
    const q = newFlow.searchQuery.trim()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!q) { setNewFlow(f => ({ ...f, searchResults:[], searchLoading:false })); return }
    setNewFlow(f => ({ ...f, searchLoading:true }))
    const timer = setTimeout(async () => {
      let results = []
      if (cat.searchType === 'base')       results = await searchBaseRecipes(q, lang)
      else if (cat.searchType === 'community')  results = await searchCommunityRecipes(q)
      else if (cat.searchType === 'ingredient') results = await searchIngredients(q, lang)
      else if (cat.searchType === 'user')       results = await searchUsersForReport(q)
      setNewFlow(f => ({ ...f, searchResults:results, searchLoading:false }))
    }, 350)
    return () => clearTimeout(timer)
  }, [newFlow.searchQuery, newFlow.category, lang])

  async function openTicket(ticket) {
    setSelectedTicket(ticket)
    const msgs = await getTicketMessages(ticket.id)
    setMessages(msgs)
    setView('detail')
    setError(null)
    if (ticket.has_unread_user) {
      await markTicketReadByUser(ticket.id)
      setTickets(prev => prev.map(tk => tk.id === ticket.id ? { ...tk, has_unread_user:false } : tk))
      onUnreadChange?.()
    }
  }

  async function handleSendReply() {
    if (!replyContent.trim() || sending) return
    setSending(true); setError(null)
    const { error: err } = await sendUserMessage(selectedTicket.id, userId, replyContent.trim())
    if (err) { setError(t.errorSend) }
    else {
      setReplyContent('')
      const msgs = await getTicketMessages(selectedTicket.id)
      setMessages(msgs)
    }
    setSending(false)
  }

  async function handleDeleteMessage(msgId) {
    if (!(await confirm({ title: t.confirmDeleteMessage, danger: true }))) return
    // L'erreur etait jetee ET l'etat local modifie quand meme : un echec
    // faisait disparaitre de l'ecran un message toujours present en base.
    const { error } = await deleteUserMessage(msgId, userId) ?? {}
    if (error) { setError(t.errorAction); return }
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function handleDeleteTicket(ticketId) {
    if (!(await confirm({ title: t.confirmDeleteTicket, danger: true }))) return
    const { error } = await deleteUserTicket(ticketId, userId) ?? {}
    if (error) { setError(t.errorAction); return }
    setTickets(prev => prev.filter(tk => tk.id !== ticketId))
    if (selectedTicket?.id === ticketId) goBack()
  }

  async function handleSaveTitle() {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === selectedTicket.title) { setEditingTitle(false); return }
    const { error } = await updateTicketTitle(selectedTicket.id, userId, trimmed) ?? {}
    if (error) { setError(t.errorAction); setEditingTitle(false); return }
    setSelectedTicket(prev => ({ ...prev, title:trimmed }))
    setTickets(prev => prev.map(tk => tk.id === selectedTicket.id ? { ...tk, title:trimmed } : tk))
    setEditingTitle(false)
  }

  function goBack() {
    setView('list'); setError(null)
    setSelectedTicket(null); setMessages([])
    setReplyContent(''); setEditingTitle(false)
  }

  function startNewFlow() {
    setNewFlow(FLOW_INIT); setError(null); setView('cat')
  }

  function selectCategory(cat) {
    setNewFlow({ ...FLOW_INIT, category:cat }); setError(null)
    setView(getSelfHelp(cat.id, lang).length > 0 ? 'help' : 'form')
  }

  function goToConfirm() {
    const { category, target, reasonKey, freeTitle } = newFlow
    if (category.flow === 'report') {
      if (!target) { setError(t.targetRequired); return }
      if (!category.fixedReason && !reasonKey) { setError(t.reasonRequired); return }
    }
    if (category.flow === 'free' && !freeTitle.trim()) { setError(t.titleRequired); return }
    setError(null); setView('confirm')
  }

  async function handleSubmit() {
    const { category, target, reasonKey, details, freeTitle } = newFlow
    setSending(true); setError(null)

    // Validation locale d'abord (champs requis), AVANT la modération IA async.
    // Ainsi : (1) un user qui oublie un champ voit immédiatement l'erreur sans
    // attendre l'appel API, (2) on n'appelle pas OpenAI pour des soumissions
    // invalides qui ne seront jamais persistées.
    if (category.flow !== 'report' && !details.trim()) {
      setError(t.messageRequired); setSending(false); return
    }

    // Modération IA OpenAI sur le contenu texte saisi (details + freeTitle).
    // On ne modère PAS target.label (nom déjà en BDD, modéré en amont).
    // Fail-open en cas de panne API : on continue, leo-profanity reste actif.
    const userText = [details, freeTitle].filter(Boolean).map(s => s.trim()).filter(Boolean).join('\n')
    if (userText.length > 0) {
      try {
        const result = await moderateContent(userText, 'ticket')
        if (result?.flagged) {
          setError(t.moderationFlagged)
          setSending(false)
          return
        }
      } catch (err) {
        console.warn('[moderation] ticket check failed', err)
      }
    }

    let ticketId = null

    if (category.flow === 'report') {
      const rKey = category.fixedReason ?? reasonKey
      const userTitle = `${target.emoji} ${target.label} — ${t.reasons[rKey] ?? rKey}`
      const { data, error: err } = await createReport({
        targetType: category.targetType,
        targetId:   target.id,
        reasonKey:  rKey,
        reasonDetails: details.trim() || null,
        userTitle,
      })
      if (err?.message === 'max_tickets_reached') { setError(t.maxTickets); setSending(false); return }
      if (err || !data) { setError(t.errorSend); setSending(false); return }
      ticketId = data.id
    } else {
      const title = category.flow === 'free' ? freeTitle.trim() : t.cats[category.id]
      const { data, error: err } = await createTicket(userId, {
        type:    category.ticketType,
        title:   title || t.cats[category.id],
        message: details.trim(),
      })
      if (err?.message === 'max_tickets_reached') { setError(t.maxTickets); setSending(false); return }
      if (err || !data) { setError(t.errorSend); setSending(false); return }
      ticketId = data.id
    }

    const updated = await getUserTickets(userId)
    setTickets(updated)
    setNewFlow(FLOW_INIT)
    setSending(false)
    const created = updated.find(tk => tk.id === ticketId)
    if (created) openTicket(created)
    else setView('list')
  }

  return {
    // état
    view, setView,
    tickets, setTickets,
    selectedTicket, setSelectedTicket,
    messages, setMessages,
    replyContent, setReplyContent,
    sending, setSending,
    error, setError,
    hoveredMsgId, setHoveredMsgId,
    editingTitle, setEditingTitle,
    titleDraft, setTitleDraft,
    newFlow, setNewFlow,
    messagesEndRef,
    // actions
    openTicket, handleSendReply, handleDeleteMessage, handleDeleteTicket,
    handleSaveTitle, goBack, startNewFlow, selectCategory, goToConfirm, handleSubmit,
  }
}
