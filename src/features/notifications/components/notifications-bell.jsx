import { useState, useRef, useEffect } from 'react'
import { LuBell } from 'react-icons/lu'
import { useAuth } from '@shared/contexts/auth-provider'
import { useNotifications } from '@features/notifications/hooks/use-notifications'
import NotificationsPanel from './notifications-panel'
import { NOTIF_I18N } from '@shared/lib/i18n/notifications-i18n'
import Button from '@shared/ui/button'
import Tooltip from '@shared/ui/tooltip'

// Cloche de notifications dans le header.
//
// État disabled si user non connecté (icône grisée). Sinon affiche un
// badge rouge avec compteur d'unread. Clic → popover NotificationsPanel.

export default function NotificationsBell({ lang = 'fr', darkMode = false, onNotificationClick }) {
  const t = NOTIF_I18N[lang] ?? NOTIF_I18N.fr
  const { user } = useAuth()
  const { unreadCount } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Si pas connecté → on n'affiche pas la cloche du tout (cohérent avec
  // les autres features connecté-only)
  if (!user) return null

  // Couleurs branded Fridge+ — orange dégradé subtil au hover/active.
  // Aligné sur le style du bouton panier pour cohérence visuelle parfaite
  // (mêmes couleurs idle/hover/active, même position de badge).
  const hoverBg     = darkMode
    ? 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.10) 100%)'
    : 'linear-gradient(135deg, rgba(247,168,94,0.18) 0%, rgba(212,106,16,0.08) 100%)'
  const hoverColor  = 'var(--color-warm-600)'
  const activeBg    = darkMode
    ? 'linear-gradient(135deg, rgba(247,168,94,0.28) 0%, rgba(212,106,16,0.18) 100%)'
    : 'linear-gradient(135deg, rgba(247,168,94,0.28) 0%, rgba(212,106,16,0.16) 100%)'

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <Tooltip text={t.bellLabel} darkMode={darkMode} disabled={open}>
        <Button
          variant="ghost"
          onClick={() => setOpen(o => !o)}
          // Le nombre de non lues est dans le nom du bouton : posé sur la
          // pastille (un <span>), il n'était jamais annoncé (lot 9e).
          aria-label={unreadCount > 0 ? `${t.bellLabel}, ${t.bellUnread(unreadCount)}` : t.bellLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="relative h-11 w-11 rounded-[11px] p-0 hover:bg-transparent"
          style={{
            background: open ? activeBg : 'transparent',
            color: open ? hoverColor : 'var(--color-muted)',
            transition: 'background 0.18s, color 0.18s',
          }}
          onMouseEnter={e => {
            if (open) return
            e.currentTarget.style.background = hoverBg
            e.currentTarget.style.color = hoverColor
          }}
          onMouseLeave={e => {
            if (open) return
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-muted)'
          }}
        >
          <LuBell size={20} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', top: '4px', right: '4px',
                width: 9, height: 9, borderRadius: '50%',
                background: 'var(--gradient-warm)',
                border: `2px solid ${darkMode ? 'rgba(15,25,35,0.94)' : 'rgba(253,246,238,0.96)'}`,
                boxShadow: '0 0 8px rgba(212,106,16,0.55)',
                boxSizing: 'content-box',
              }}
            />
          )}
        </Button>
      </Tooltip>

      {open && (
        <NotificationsPanel
          lang={lang}
          darkMode={darkMode}
          onClose={() => setOpen(false)}
          onNotificationClick={onNotificationClick}
        />
      )}
    </div>
  )
}
