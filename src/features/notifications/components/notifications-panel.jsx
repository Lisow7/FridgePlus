import { useState } from 'react'
import { LuCheck, LuTrash2, LuCheckCheck, LuChevronDown, LuChevronUp } from 'react-icons/lu'
import { useNotifications } from '@features/notifications/hooks/use-notifications'
import { NOTIF_I18N, formatRelativeTime, localizeNotifText } from '@shared/lib/i18n/notifications-i18n'
import { useWindowWidth } from '@shared/hooks/use-window-width'
import { useCloseOnBackButton } from '@shared/hooks/use-close-on-back-button'
import Button from '@shared/ui/button'

// Heuristique : on considère le body « long » à partir de ~110 caractères
// (≈ 2 lignes en 12px sur 360px de largeur). Au-delà, on tronque par défaut
// et on affiche un bouton « Voir plus ». En-dessous, on affiche tout.
const BODY_TRUNCATE_THRESHOLD = 110

// Notifications groupées par catégorie (Support / Mes recettes /
// Communauté / Autres). Les sections vides sont cachées. Cohérent avec le
// pattern des sections du UserMenu (label uppercase + barre orange).

const TYPE_EMOJI = {
  ticket_reply:         '💬',
  recipe_approved:      '🎉',
  recipe_rejected:      '🚫',
  recipe_promoted:      '⭐',
  recipe_pending:       '🍳',
  forum_reply:          '💭',
  forum_mention:        '👤',
  vote_open:            '🗳️',
  vote_result:          '📊',
  announcement:         '📣',
  maintenance:          '🔧',
  admin_message:        '✉️',
  leftover_expiring:    '🍲',
  default:              '🔔',
}

// Mapping type → catégorie. Si un type n'est pas listé, il tombe dans
// « Autres » (la catégorie n'apparaît que s'il y a au moins une notif
// de ce type — pas de section vide).
const TYPE_CATEGORY = {
  ticket_reply:         'support',
  recipe_approved:      'recipes',
  recipe_rejected:      'recipes',
  recipe_promoted:      'recipes',
  recipe_pending:       'recipes',
  forum_reply:          'community',
  forum_mention:        'community',
  vote_open:            'community',
  vote_result:          'community',
  leftover_expiring:    'fridge',
}

// Ordre d'affichage des catégories (Support en premier — actions humaines
// les plus importantes). Garantit un ordre stable même si le serveur
// renvoie les notifs dans un ordre qui mixte les catégories.
const CATEGORY_ORDER = ['support', 'fridge', 'recipes', 'community', 'other']

const CATEGORY_LABELS = {
  support:   'catSupport',
  fridge:    'catFridge',
  recipes:   'catRecipes',
  community: 'catCommunity',
  other:     'catOther',
}

const CLICKABLE_TYPES = new Set([
  'ticket_reply',
  'recipe_approved',
  'recipe_rejected',
  'recipe_promoted',
])

function groupByCategory(notifications) {
  const groups = {}
  for (const n of notifications) {
    const cat = TYPE_CATEGORY[n.type] ?? 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(n)
  }
  return groups
}

function CategoryHeader({ label, darkMode }) {
  return (
    <div style={{
      padding: '10px 14px 6px',
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '11px', fontWeight: 700,
      color: darkMode ? 'rgba(247,168,94,0.95)' : 'rgba(212,106,16,0.85)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      background: darkMode ? 'rgba(247,168,94,0.04)' : 'rgba(212,106,16,0.03)',
    }}>
      <span aria-hidden="true" style={{
        display: 'inline-block',
        width: '3px', height: '12px',
        background: 'linear-gradient(180deg, #F7A85E 0%, #D46A10 100%)',
        borderRadius: '2px',
      }} />
      <span>{label}</span>
    </div>
  )
}

// Exporté pour réutilisation dans l'aperçu live du compose admin
// (notifications-section.jsx) — garantit que l'admin voit EXACTEMENT le
// même rendu (emoji, retours à ligne, troncature) que ce que verra le user.
export function NotifItem({ n, lang, darkMode, fg, muted, border, t, onClick, onMarkRead, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isUnread = !n.read_at
  const emoji = TYPE_EMOJI[n.type] ?? TYPE_EMOJI.default
  const clickable = CLICKABLE_TYPES.has(n.type)

  const handleClick = clickable ? () => onClick(n) : undefined
  const handleKey = clickable ? (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(n)
    }
  } : undefined

  // Body localisé + détection « long » (justification admin = potentiellement
  // plusieurs phrases). Si long, on affiche 2 lignes max + bouton « Voir plus ».
  const bodyText = n.body ? localizeNotifText(n.body, lang) : null
  const isLongBody = !!bodyText && bodyText.length > BODY_TRUNCATE_THRESHOLD

  const baseBg = isUnread
    ? (darkMode ? 'rgba(247,168,94,0.08)' : 'rgba(247,168,94,0.06)')
    : 'transparent'
  const hoverBg = darkMode ? 'rgba(247,168,94,0.14)' : 'rgba(247,168,94,0.10)'

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        display: 'flex', gap: 10,
        padding: '11px 14px',
        borderBottom: `1px solid ${border}`,
        background: baseBg,
        opacity: isUnread ? 1 : 0.75,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = hoverBg } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = baseBg } : undefined}
    >
      <div aria-hidden="true" style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: isUnread ? 700 : 500, color: fg,
          marginBottom: 2, display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          {isUnread && (
            <span aria-hidden="true" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--gradient-warm)',
              marginTop: 6, flexShrink: 0,
              boxShadow: '0 0 6px rgba(212,106,16,0.55)',
            }} />
          )}
          <span style={{ flex: 1 }}>{localizeNotifText(n.title, lang)}</span>
        </div>
        {bodyText && (
          <>
            <div
              style={{
                fontSize: 12, color: muted, lineHeight: 1.5,
                marginBottom: isLongBody ? 2 : 4,
                whiteSpace: 'pre-wrap',
                ...(isLongBody && !expanded ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } : {}),
              }}
            >
              {bodyText}
            </div>
            {isLongBody && (
              <Button
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
                aria-expanded={expanded}
                aria-label={expanded ? t.showLess : t.showMore}
                className="h-auto rounded-none px-0 py-0.5 text-[11px] font-semibold hover:bg-transparent"
                style={{
                  gap: '4px',
                  color: 'var(--color-warm-600)',
                  marginBottom: 4,
                }}
              >
                {expanded
                  ? <LuChevronUp size={12} aria-hidden="true" />
                  : <LuChevronDown size={12} aria-hidden="true" />}
                <span>{expanded ? t.showLess : t.showMore}</span>
              </Button>
            )}
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: muted }}>
            {formatRelativeTime(n.created_at, lang)}
          </span>
          {isUnread && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); onMarkRead(n.id) }}
              title={t.markAllRead}
              aria-label={t.markAllRead}
              className="h-auto w-auto rounded-none p-0 text-[11px] hover:bg-transparent"
              style={{ color: 'var(--color-success)', gap: '3px' }}
            >
              <LuCheck size={11} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(n.id) }}
            title={t.deleteOne}
            aria-label={t.deleteOne}
            className="h-auto w-auto rounded-none p-0 text-[11px] hover:bg-transparent"
            style={{ color: muted, marginLeft: 'auto' }}
          >
            <LuTrash2 size={11} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPanel({ lang = 'fr', darkMode = false, onClose, onNotificationClick }) {
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640
  const t = NOTIF_I18N[lang] ?? NOTIF_I18N.fr
  const { notifications, markRead, markAllRead, deleteNotif, deleteAllRead } = useNotifications()
  useCloseOnBackButton(true, onClose)

  const handleNotifClick = (n) => {
    if (!n.read_at) markRead(n.id)
    if (CLICKABLE_TYPES.has(n.type)) {
      onNotificationClick?.(n)
      onClose?.()
    }
  }

  const bg     = darkMode ? '#1A2F48' : '#FFFFFF'
  const fg     = darkMode ? 'var(--color-bg-warm)' : '#2C1A0E'
  const muted  = darkMode ? '#A0A8B8' : '#7A6A52'
  const border = darkMode ? 'var(--color-dark-border)' : 'var(--color-border-warm)'

  const hasUnread = notifications.some(n => !n.read_at)
  const hasRead   = notifications.some(n => n.read_at)
  const groups    = groupByCategory(notifications)

  return (
    <div
      role="dialog"
      aria-label={t.panelTitle}
      style={{
        // Sur mobile, position fixe ancrée sous le header avec
        // marges 8px de chaque côté (le panel ne déborde plus à gauche du
        // viewport quand l'icône 🔔 n'est pas tout à droite). Sur desktop :
        // absolute ancré au bouton (comportement d'origine).
        position: isMobile ? 'fixed' : 'absolute',
        top: isMobile ? '76px' : 'calc(100% + 8px)',
        right: isMobile ? '8px' : 0,
        left: isMobile ? '8px' : 'auto',
        width: isMobile ? 'auto' : 380,
        maxWidth: isMobile ? 'none' : '92vw',
        background: bg, color: fg,
        border: `1px solid ${border}`, borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        zIndex: 100,
        maxHeight: isMobile ? 'calc(100vh - 92px)' : '70vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'notifs-fade-in 0.18s ease-out',
      }}
    >
      <style>{`@keyframes notifs-fade-in { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }`}</style>

      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{t.panelTitle}</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            onClick={markAllRead}
            className="h-auto rounded-none p-1 text-[11px] font-semibold hover:bg-transparent"
            style={{ color: 'var(--color-brand-500)', gap: '4px' }}
          >
            <LuCheckCheck size={12} aria-hidden="true" />
            {t.markAllRead}
          </Button>
        )}
      </div>

      {/* Liste groupée */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ fontSize: 28, opacity: 0.5, marginBottom: 8 }}>🔕</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 4 }}>{t.empty}</div>
            <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{t.emptyHint}</div>
          </div>
        ) : (
          CATEGORY_ORDER.map(cat => {
            const items = groups[cat]
            if (!items || items.length === 0) return null
            return (
              <section key={cat}>
                <CategoryHeader label={t[CATEGORY_LABELS[cat]] ?? cat} darkMode={darkMode} />
                {items.map(n => (
                  <NotifItem
                    key={n.id}
                    n={n}
                    lang={lang}
                    darkMode={darkMode}
                    fg={fg} muted={muted} border={border} t={t}
                    onClick={handleNotifClick}
                    onMarkRead={markRead}
                    onDelete={deleteNotif}
                  />
                ))}
              </section>
            )
          })
        )}
      </div>

      {/* Footer actions */}
      {hasRead && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <Button
            variant="ghost"
            onClick={deleteAllRead}
            className="h-auto rounded-none px-0 py-0 text-xs font-semibold hover:bg-transparent"
            style={{ color: muted }}
          >
            {t.deleteAllRead}
          </Button>
        </div>
      )}
    </div>
  )
}
