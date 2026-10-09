import { useEffect, useState, useCallback } from 'react'
import { LuRefreshCw, LuPlus, LuTrash2, LuX, LuSend, LuCircleCheck } from 'react-icons/lu'
import { getAdminFeed, adminDeleteNotification, adminSendNotification, sendAnnouncementPush, getAdminFeedCounts } from '@features/notifications/api/notifications'
import { NotifItem } from '@features/notifications/components/notifications-panel'
import { NOTIF_I18N, formatRelativeTime, localizeNotifText } from '@shared/lib/i18n/notifications-i18n'
import { useFeatureFlag } from '@shared/contexts/feature-flags-provider'
import { useAdmin } from '../../providers/admin-provider'
import Button from '@shared/ui/button'
import FilterPill from '@shared/ui/filter-pill'
import Pagination from '@shared/ui/pagination'
import { useReloader } from '@shared/hooks/use-reloader'

const PER_PAGE = 30

const TYPE_CFG = {
  recipe_pending: { emoji: '🍳', label: 'Recette à modérer',   color: 'var(--color-brand-500)' },
  ticket_new:     { emoji: '💬', label: 'Nouveau ticket',       color: 'var(--color-info)' },
  report_new:     { emoji: '🚨', label: 'Nouveau signalement',  color: 'var(--color-danger)' },
  user_signup:    { emoji: '👤', label: 'Nouvelle inscription', color: 'var(--color-success)' },
  announcement:   { emoji: '📣', label: 'Annonce',              color: '#7C5CAF' },
  maintenance:    { emoji: '🔧', label: 'Maintenance',          color: 'var(--color-warning)' },
  admin_message:  { emoji: '✉️', label: 'Message admin',        color: '#5A7AAA' },
  default:        { emoji: '🔔', label: 'Notification',         color: '#7A6A52' },
}

const FILTER_TYPES = [
  { key: '',               label: 'Tous' },
  { key: 'announcement',  label: '📣 Annonce' },
  { key: 'maintenance',   label: '🔧 Maintenance' },
  { key: 'admin_message', label: '✉️ Message' },
  { key: 'recipe_pending',label: '🍳 Recette' },
  { key: 'ticket_new',    label: '💬 Ticket' },
  { key: 'report_new',    label: '🚨 Signalement' },
  { key: 'user_signup',   label: '👤 Inscription' },
]

const SEND_TYPES = [
  { key: 'announcement', label: '📣 Annonce',       desc: 'Broadcast vers tous les users' },
  { key: 'maintenance',  label: '🔧 Maintenance',   desc: 'Alerte temporaire' },
  { key: 'admin_message',label: '✉️ Message ciblé', desc: 'Vers un utilisateur précis (UUID)' },
]

const EXPIRE_OPTIONS = [
  { days: 7,  label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
]

function ComposeModal({ darkMode, onClose, onSent }) {
  const [type,       setType]       = useState('announcement')
  const [titleFr,    setTitleFr]    = useState('')
  const [titleEn,    setTitleEn]    = useState('')
  const [bodyFr,     setBodyFr]     = useState('')
  const [bodyEn,     setBodyEn]     = useState('')
  const [targetUser, setTargetUser] = useState('')
  const [expireDays, setExpireDays] = useState(30)
  const [sending,    setSending]    = useState(false)
  const [error,      setError]      = useState(null)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const bg     = darkMode ? '#1A2F48' : '#FFFFFF'
  const inp    = { width:'100%', padding:'8px 11px', borderRadius:8, border:`1px solid ${border}`, background: darkMode ? '#141F2E' : '#FBF8F3', color:fg, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  const isTargeted = type === 'admin_message'
  const pushEnabled = useFeatureFlag('push_notifications', false)

  async function handleSend() {
    if (!titleFr.trim()) { setError('Le titre (FR) est obligatoire.'); return }
    if (isTargeted && !targetUser.trim()) { setError('Saisir un user_id pour le message ciblé.'); return }
    setSending(true); setError(null)
    const finalTitleFr = titleFr.trim()
    const finalTitleEn = titleEn.trim() || finalTitleFr
    const finalBodyFr  = bodyFr.trim() || null
    const finalBodyEn  = bodyEn.trim() || null
    const { error: err } = await adminSendNotification({
      type,
      titleFr:     finalTitleFr,
      titleEn:     finalTitleEn,
      bodyFr:      finalBodyFr,
      bodyEn:      finalBodyEn,
      recipientId: isTargeted ? targetUser.trim() : null,
      expiresDays: expireDays,
    })
    setSending(false)
    if (err) { setError(err.message); return }
    if (pushEnabled && (type === 'announcement' || type === 'maintenance')) {
      sendAnnouncementPush({ type, titleFr: finalTitleFr, titleEn: finalTitleEn, bodyFr: finalBodyFr, bodyEn: finalBodyEn })
        .catch(pushErr => console.warn('[ComposeModal] sendAnnouncementPush a échoué (in-app déjà envoyé, non bloquant) :', pushErr))
    }
    onSent()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.48)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width:'100%', maxWidth:500, background:bg, borderRadius:16, border:`1px solid ${border}`, padding:'22px 24px', display:'flex', flexDirection:'column', gap:14, boxShadow:'0 8px 40px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:15, fontWeight:800, color:fg }}>Envoyer une notification</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fermer"
            className="h-auto w-auto bg-transparent p-1 hover:bg-transparent"
            style={{ color: muted }}
          >
            <LuX size={16} />
          </Button>
        </div>

        {error && <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'var(--color-danger)', fontSize:12 }}>{error}</div>}

        {/* Type */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Type</label>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {SEND_TYPES.map(opt => (
              <Button
                key={opt.key}
                variant="ghost"
                aria-pressed={type === opt.key}
                onClick={() => setType(opt.key)}
                className="h-auto w-full justify-start rounded-[10px] border px-3 py-2 text-left hover:bg-transparent"
                style={{
                  gap: 10,
                  borderColor: type === opt.key ? 'var(--color-brand-500)' : border,
                  background: type === opt.key ? 'rgba(224,120,32,0.1)' : 'transparent',
                }}
              >
                <span style={{ fontSize:13, fontWeight: type === opt.key ? 700 : 500, color:fg }}>{opt.label}</span>
                <span style={{ fontSize:11, color:muted, marginLeft:'auto' }}>{opt.desc}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Cible */}
        {isTargeted && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>User ID (UUID)</label>
            <input value={targetUser} onChange={e => setTargetUser(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inp} />
            <span style={{ fontSize:11, color:muted }}>Copie depuis la section Utilisateurs.</span>
          </div>
        )}

        {/* Titres */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Titre (FR) *</label>
          <input value={titleFr} onChange={e => setTitleFr(e.target.value)}
            placeholder="Ex : Maintenance prévue le 8 mai à 22h" style={inp} maxLength={120} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Titre (EN) — optionnel</label>
          <input value={titleEn} onChange={e => setTitleEn(e.target.value)}
            placeholder="Ex : Scheduled maintenance on May 8 at 10pm" style={inp} maxLength={120} />
          <span style={{ fontSize:11, color:muted }}>Si vide, le titre FR est utilisé pour toutes les langues.</span>
        </div>

        {/* Corps FR + EN */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Corps (FR) — optionnel</label>
          <textarea value={bodyFr} onChange={e => setBodyFr(e.target.value)}
            placeholder={'Détails supplémentaires…\n\nAstuce : une idée par ligne (emoji + phrase courte) — les retours à la ligne sont conservés à l\'affichage.'}
            rows={4} maxLength={400}
            style={{ ...inp, resize:'vertical', lineHeight:1.5, fontFamily:'inherit' }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Corps (EN) — optionnel</label>
          <textarea value={bodyEn} onChange={e => setBodyEn(e.target.value)}
            placeholder="Additional details…" rows={3} maxLength={400}
            style={{ ...inp, resize:'vertical', lineHeight:1.5, fontFamily:'inherit' }} />
          <span style={{ fontSize:11, color:muted }}>Si vide, le corps FR est utilisé pour toutes les langues.</span>
        </div>

        {/* Aperçu live — rendu EXACT (mêmes composant/styles) que ce que
            verra le destinataire dans sa cloche. Se met à jour à la frappe. */}
        {(titleFr.trim() || bodyFr.trim()) && (
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Aperçu — ce que verra le destinataire</label>
            <div style={{ border:`1px solid ${border}`, borderRadius:10, overflow:'hidden', background: darkMode ? '#141F2E' : '#FBF8F3' }}>
              <NotifItem
                n={{
                  id: 'preview',
                  type,
                  title: { fr: titleFr.trim() || '…', en: titleEn.trim() || titleFr.trim() || '…' },
                  body: bodyFr.trim() ? { fr: bodyFr, en: bodyEn.trim() || bodyFr } : null,
                  created_at: new Date().toISOString(),
                  read_at: null,
                }}
                lang="fr"
                darkMode={darkMode}
                fg={fg} muted={muted} border={border}
                t={NOTIF_I18N.fr}
                onClick={() => {}}
                onMarkRead={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        )}

        {/* Expiration */}
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:11, fontWeight:700, color:muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Expiration</label>
          <div style={{ display:'flex', gap:6 }}>
            {EXPIRE_OPTIONS.map(o => (
              <Button
                key={o.days}
                variant="ghost"
                aria-pressed={expireDays === o.days}
                onClick={() => setExpireDays(o.days)}
                className="h-auto flex-1 rounded-lg border px-2 py-1.5 text-xs hover:bg-transparent"
                style={{
                  borderColor: expireDays === o.days ? 'var(--color-brand-500)' : border,
                  background: expireDays === o.days ? 'rgba(224,120,32,0.12)' : 'transparent',
                  color: expireDays === o.days ? 'var(--color-brand-500)' : muted,
                  fontWeight: expireDays === o.days ? 700 : 500,
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:4 }}>
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-auto rounded-[9px] border bg-transparent px-4 py-2 text-[13px] hover:bg-transparent"
            style={{ borderColor: border, color: muted }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            loading={sending}
            disabled={sending}
            className="h-auto rounded-[9px] bg-[#E07820] px-[18px] py-2 text-[13px] font-bold text-white"
            style={{ gap: 7 }}
          >
            {!sending && <LuSend size={13} />}{sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsSection({ lang = 'fr', darkMode = false }) {
  const t = NOTIF_I18N[lang] ?? NOTIF_I18N.fr
  const { setSection } = useAdmin()

  const [items,       setItems]       = useState([])
  const [count,       setCount]       = useState(0)
  const [counts,      setCounts]      = useState({})
  const [page,        setPage]        = useState(0)
  const [typeFilter,  setTypeFilter]  = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [sentBanner,  setSentBanner]  = useState(false)

  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'
  const rowBg  = darkMode ? '#1A2F48' : '#FFFFFF'

  // `useReloader` garantit le `finally` (sans lui, une erreur réseau laissait
  // le voyant allumé pour toujours) et périme les réponses en retard : sans ça,
  // enchaîner deux filtres laissait la plus ancienne écraser la plus récente.
  const { loading, reload: loadFeed } = useReloader(async (estObsolete) => {
    const { data, count: c } = await getAdminFeed({ page, type: typeFilter || null })
    if (estObsolete()) return
    setItems(data ?? [])
    setCount(c ?? 0)
  }, [page, typeFilter])

  const loadCounts = useCallback(async () => {
    const { counts: c } = await getAdminFeedCounts()
    setCounts(c)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCounts() }, [loadCounts])

  function handleSent() {
    setShowCompose(false)
    setSentBanner(true)
    setTimeout(() => setSentBanner(false), 4000)
    loadFeed()
    loadCounts()
  }

  async function handleDelete(id) {
    const { error } = await adminDeleteNotification(id)
    if (!error) {
      setItems(its => its.filter(i => i.id !== id))
      loadCounts()
    }
  }

  function handleDeepLink(n) {
    if (n.type === 'recipe_pending' || n.metadata?.recipe_id) return setSection('recipes')
    if (n.type === 'ticket_new'    || n.metadata?.ticket_id)  return setSection('support')
    if (n.type === 'report_new'    || n.metadata?.report_id)  return setSection('reports')
    if (n.type === 'user_signup'   || n.metadata?.user_id)    return setSection('users')
  }

  return (
    <>
      {showCompose && (
        <ComposeModal
          darkMode={darkMode}
          onClose={() => setShowCompose(false)}
          onSent={handleSent}
        />
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Bannière succès */}
        {sentBanner && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:10, background:'rgba(22,163,74,0.12)', border:'1px solid rgba(22,163,74,0.3)', color:'var(--color-success)', fontSize:13, fontWeight:600 }}>
            <LuCircleCheck size={15} />
            Notification envoyée avec succès.
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:7, justifyContent:'flex-end' }}>
          <Button
            variant="ghost"
            onClick={loadFeed}
            disabled={loading}
            className="h-auto rounded-lg border bg-transparent px-3 py-2 text-xs font-semibold hover:bg-transparent"
            style={{ gap: 6, borderColor: border, color: fg }}
          >
            <LuRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            {t.refresh}
          </Button>
          <Button
            onClick={() => setShowCompose(true)}
            className="h-auto rounded-lg bg-[#E07820] px-3.5 py-2 text-xs font-bold text-white"
            style={{ gap: 6 }}
          >
            <LuPlus size={13} /> Envoyer
          </Button>
        </div>

        {/* Filtres type — toujours visibles, indépendants des items chargés */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {FILTER_TYPES.map(({ key, label }) => {
            const cfg = TYPE_CFG[key] ?? null
            const pillCount = key === ''
              ? Object.values(counts).reduce((sum, n) => sum + n, 0)
              : (counts[key] ?? 0)
            return (
              <FilterPill
                key={key}
                active={typeFilter === key}
                color={cfg?.color ?? 'var(--color-brand-500)'}
                count={pillCount}
                onClick={() => { setTypeFilter(key); setPage(0) }}
                border={border}
                muted={muted}
              >
                {label}
              </FilterPill>
            )
          })}
        </div>

        {/* Feed */}
        {loading ? (
          <div style={{ padding:'28px', textAlign:'center', color:muted, fontSize:13 }}>Chargement…</div>
        ) : items.length === 0 ? (
          <div style={{ padding:'36px 18px', textAlign:'center' }}>
            <div style={{ fontSize:28, opacity:0.4, marginBottom:8 }}>🔕</div>
            <div style={{ fontSize:13, color:muted, fontStyle:'italic' }}>{t.adminEmpty}</div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {items.map(n => {
                const cfg     = TYPE_CFG[n.type] ?? TYPE_CFG.default
                const hasLink = ['recipe_pending','ticket_new','report_new','user_signup'].includes(n.type) || n.metadata?.recipe_id || n.metadata?.ticket_id
                return (
                  <div key={n.id} style={{ display:'flex', gap:12, padding:'11px 14px', borderRadius:10, background:rowBg, border:`1px solid ${border}` }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:`${cfg.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
                      {cfg.emoji}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:fg, marginBottom:2 }}>
                        {localizeNotifText(n.title, lang)}
                      </div>
                      {n.body && (
                        <div style={{ fontSize:12, color:muted, lineHeight:1.45, marginBottom:4, whiteSpace:'pre-wrap' }}>
                          {localizeNotifText(n.body, lang)}
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', fontSize:11, color:muted }}>
                        <span style={{ padding:'1px 7px', borderRadius:8, background:`${cfg.color}18`, color:cfg.color, fontWeight:600 }}>{cfg.label}</span>
                        <span>{formatRelativeTime(n.created_at, lang)}</span>
                        {hasLink && (
                          <Button
                            variant="link"
                            onClick={() => handleDeepLink(n)}
                            className="h-auto bg-transparent p-0 text-[11px] underline hover:bg-transparent"
                            style={{ color: cfg.color }}
                          >
                            Ouvrir →
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(n.id)}
                      title="Supprimer du feed"
                      aria-label="Supprimer du feed"
                      className="h-auto w-auto flex-shrink-0 self-start bg-transparent p-1 opacity-60 hover:bg-transparent"
                      style={{ color: muted }}
                    >
                      <LuTrash2 size={13} />
                    </Button>
                  </div>
                )
              })}
            </div>

            {count > PER_PAGE && (
              <Pagination
                page={page}
                totalPages={Math.ceil(count / PER_PAGE)}
                onPageChange={setPage}
                itemsCount={count}
                itemsLabel="notifs"
                border={border}
                muted={muted}
                text={fg}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
